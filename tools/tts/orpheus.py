#!/usr/bin/env python3
"""Narrate the reel with Orpheus 3B, locally.

Orpheus is not a vocoder — it is a Llama-3B that has been taught to emit audio
codec tokens instead of text. Those tokens are then decoded to waveform by
SNAC, a separate neural codec. So this is a two-model pipeline:

    text  ──[Orpheus 3B]──>  codec tokens  ──[SNAC 24kHz]──>  24kHz audio

The token layout is the fiddly part and is worth stating once. Orpheus emits
audio tokens in frames of SEVEN. Each frame carries one code for SNAC's
coarsest codebook, two for the middle, and four for the finest — SNAC is
hierarchical, so the layers run at different rates. On top of that, each of
the seven positions is offset by a further 4096 so that every position gets
its own disjoint slice of the vocabulary. Both facts have to be undone in the
right order or the decode produces confident noise rather than speech.

The upstream project runs on vLLM, which has no Apple-silicon build, so this
drives the model through plain transformers on MPS instead.

    python tools/tts/orpheus.py --text "hello there" --out hello.wav
    python tools/tts/orpheus.py --script narration.json --outdir audio/
"""

import argparse
import json
import os
import pathlib
import sys
import time

import numpy as np
import soundfile as sf
import torch
from snac import SNAC
from transformers import AutoModelForCausalLM, AutoTokenizer

# Canopy Labs' own repo is gated — it needs a licence click and an HF token,
# and the CLI happily exits 0 having downloaded the 403 page. unsloth mirrors
# the same finetuned weights ungated, so the default works on a fresh machine.
# Override with --model to use the canonical repo once access is granted.
ORPHEUS = "unsloth/orpheus-3b-0.1-ft"
SNAC_MODEL = "hubertsiuzdak/snac_24khz"
SAMPLE_RATE = 24000

# Frame geometry, from the reference decoder. Seven codes per frame, split
# across SNAC's three codebooks at 1 / 2 / 4 codes per frame respectively.
FRAME = 7
CODEBOOK = 4096

# Prompt scaffolding, from the reference implementation. The trailing 128257
# means generation starts *inside* the audio stream — there is no preamble to
# skip and no start-of-audio marker to search for in the output.
TOK_START = 128259
TOK_END = [128009, 128260, 128261, 128257]
TOK_STOP = 128258          # end of speech


def device():
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load(dev, repo=ORPHEUS):
    tok = AutoTokenizer.from_pretrained(repo)
    model = AutoModelForCausalLM.from_pretrained(
        repo, dtype=torch.float16 if dev != "cpu" else torch.float32)
    model.to(dev).eval()
    snac = SNAC.from_pretrained(SNAC_MODEL).eval().to(dev)

    """Find where the audio vocabulary starts rather than hard-coding it.

    The reference decoder parses '<custom_token_N>' out of the generated TEXT
    and does N - 10. Working in token ids is far cheaper, but only if we know
    the id of custom_token_0 — and a tokenizer revision that shifted the
    special-token block would silently offset every code by a constant, which
    decodes as noise rather than as an error. So ask the tokenizer.
    """
    base = tok.convert_tokens_to_ids("<custom_token_0>")
    if base is None or base == tok.unk_token_id:
        raise SystemExit("tokenizer has no <custom_token_0>; cannot locate the "
                         "audio vocabulary")
    return tok, model, snac, base


def generate_codes(tok, model, dev, base, text, voice, seed,
                   temperature, top_p, repetition_penalty, max_new_tokens):
    prompt = f"{voice}: {text}"
    ids = tok(prompt, return_tensors="pt").input_ids
    ids = torch.cat([
        torch.tensor([[TOK_START]], dtype=torch.int64),
        ids,
        torch.tensor([TOK_END], dtype=torch.int64),
    ], dim=1).to(dev)

    # Fixed seed per line: the same text must give the same audio, so a
    # re-render of one line does not change the ones around it.
    torch.manual_seed(seed)
    with torch.inference_mode():
        out = model.generate(
            ids,
            attention_mask=torch.ones_like(ids),
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            max_new_tokens=max_new_tokens,
            eos_token_id=TOK_STOP,
            pad_token_id=TOK_STOP,
        )
    return out[0, ids.shape[1]:].tolist()


def codes_to_audio(raw, snac, dev, base):
    """Undo the two offsets, split into SNAC's three codebooks, decode.

    Position within the frame is counted over the RAW stream, not over the
    audio tokens that survive filtering. That distinction is the whole game.
    Orpheus occasionally emits a stray text token mid-stream — about six times
    in four hundred here — and those strays sit in a frame slot rather than
    displacing it. Drop them and renumber, and every following token is read
    against the wrong 4096-wide slice: one glitch near the start corrupts the
    entire rest of the line. Counted absolutely, the same stream has six bad
    codes and 359 good ones.
    """
    audio_base = base + 10          # custom_token_10 is code 0

    codes = []
    for t in raw:
        if t == TOK_STOP:
            break
        codes.append(t)
    codes = codes[: len(codes) - len(codes) % FRAME]
    if not codes:
        return None

    # Position offset: slot j of a frame lives in slice j of the vocabulary.
    flat = [c - audio_base - (i % FRAME) * CODEBOOK for i, c in enumerate(codes)]

    """Conceal the strays instead of aborting on them.

    A code outside [0, 4096) is not decodable, but it is also one twentieth of
    one percent of the stream — the same situation a codec faces when a packet
    is lost, and the same remedy applies: repeat the previous frame's code in
    that slot. Inaudible at this rate. A large fraction, though, means the
    frame alignment itself is wrong rather than the model having hiccuped, and
    concealing that would produce fluent-sounding noise — so it still fails.
    """
    bad = [i for i, c in enumerate(flat) if c < 0 or c >= CODEBOOK]
    if len(bad) > max(8, len(flat) // 20):
        raise ValueError(f"{len(bad)}/{len(flat)} codes out of range — "
                         "frame alignment is wrong, not a model glitch")
    for i in bad:
        flat[i] = flat[i - FRAME] if i >= FRAME else 0
    if bad:
        print(f"[tts]   concealed {len(bad)} stray token(s) of {len(flat)}",
              flush=True)

    l1, l2, l3 = [], [], []
    for j in range(len(flat) // FRAME):
        i = FRAME * j
        l1.append(flat[i])
        l2.extend([flat[i + 1], flat[i + 4]])
        l3.extend([flat[i + 2], flat[i + 3], flat[i + 5], flat[i + 6]])

    layers = [torch.tensor(x, dtype=torch.int32, device=dev).unsqueeze(0)
              for x in (l1, l2, l3)]
    with torch.inference_mode():
        wav = snac.decode(layers)
    return wav.squeeze().float().cpu().numpy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text")
    ap.add_argument("--script", help="JSON list of {id, text} to render")
    ap.add_argument("--out", default="out.wav")
    ap.add_argument("--outdir")
    ap.add_argument("--voice", default="tara")
    ap.add_argument("--model", default=ORPHEUS)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--temperature", type=float, default=0.6)
    ap.add_argument("--top-p", type=float, default=0.8)
    ap.add_argument("--repetition-penalty", type=float, default=1.3)
    ap.add_argument("--max-new-tokens", type=int, default=2400)
    args = ap.parse_args()

    dev = device()
    print(f"[tts] device={dev}", flush=True)
    t0 = time.time()
    tok, model, snac, base = load(dev, args.model)
    print(f"[tts] models loaded in {time.time()-t0:.0f}s "
          f"(audio vocab starts at {base + 10})", flush=True)

    def render(text, path):
        t = time.time()
        raw = generate_codes(tok, model, dev, base, text, args.voice,
                             args.seed, args.temperature, args.top_p,
                             args.repetition_penalty, args.max_new_tokens)
        wav = codes_to_audio(raw, snac, dev, base)
        if wav is None:
            raise ValueError("model produced no audio tokens")
        sf.write(path, wav, SAMPLE_RATE)
        dur = len(wav) / SAMPLE_RATE
        print(f"[tts] {path}  {dur:5.1f}s audio  "
              f"({time.time()-t:.0f}s, {dur/(time.time()-t):.2f}x realtime)",
              flush=True)
        return dur

    if args.script:
        lines = json.loads(pathlib.Path(args.script).read_text())
        outdir = pathlib.Path(args.outdir or "audio")
        outdir.mkdir(parents=True, exist_ok=True)
        total = 0.0
        for i, line in enumerate(lines):
            path = outdir / f"{line['id']}.wav"
            if path.exists():
                total += sf.info(path).duration
                print(f"[tts] {path} exists, skipping", flush=True)
                continue
            total += render(line["text"], str(path))
        print(f"[tts] {len(lines)} lines, {total/60:.1f} min of narration")
    elif args.text:
        render(args.text, args.out)
    else:
        sys.exit("need --text or --script")


if __name__ == "__main__":
    main()
