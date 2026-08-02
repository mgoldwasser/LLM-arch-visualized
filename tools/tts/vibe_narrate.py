#!/usr/bin/env python3
"""Render narration as ONE conversation instead of 99 utterances.

Every Chatterbox render in this project generates each line alone, and the
result has a signature: each line carries the same energy envelope — start,
arc, land — because each line IS a complete performance. Listened to for a
few seconds it passes; over a minute the repetition of that shape is what
reads as synthetic. No per-line knob fixes a defect that lives between the
lines.

VibeVoice generates the whole dialogue in a single pass, conditioned on both
speakers, so turn-taking, cut-in timing and paragraph-scale energy come from
the model rather than from injected leads and widened silences. The speaker
references are the same synthetic clips minted by design_refs.py — voices
that have never belonged to anyone.

The script format is plain "Speaker N:" turns. No pause markers, no emphasis
asterisks, no registers: the conversation-level prosody is the model's job
now, which is the entire reason to use it.

    tools/tts/.venv-vibevoice/bin/python tools/tts/vibe_narrate.py \
        --script convo.json --out convo.wav
"""

import argparse
import json
import pathlib
import re
import time

import soundfile as sf
import torch

from vibevoice.modular.modeling_vibevoice_inference import (
    VibeVoiceForConditionalGenerationInference,
)
from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor

MODEL = "vibevoice/VibeVoice-1.5B"
REFS = pathlib.Path(__file__).parent / "refs"

# Speaker order maps names to "Speaker 1"/"Speaker 2" slots. Charlie first:
# he opens the show and carries most of the words.
SPEAKERS = ["charlie", "danny"]


def to_turns(lines):
    """Script lines become 'Speaker N:' turns, one turn per line.

    Consecutive lines by the same speaker are deliberately NOT merged: a
    turn boundary is the one reliable pause this model offers, so the
    script's line breaks are its pacing marks. A dense math passage split
    into three short entries gets three settled beats; a narrative aside
    written as one flowing entry keeps its momentum. Pace control lives in
    the writing — sentence length and line breaks — not in knobs, because
    those are the only levers a one-pass model actually honours.
    """
    turns = []
    for l in lines:
        idx = SPEAKERS.index(l["speaker"]) + 1
        # Chatterbox-era markup means nothing here: pauses and emphasis are
        # the model's decision now. Strip "||0.4" markers and *asterisks*.
        text = re.sub(r"\s*\|\|\d*(?:\.\d+)?\s*", " ", l["text"])
        text = text.replace("*", "")
        text = re.sub(r"\s{2,}", " ", text).strip()
        turns.append((idx, text))
    return "\n".join(f"Speaker {i}: {t}" for i, t in turns)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True,
                    help="narration-format json (id/speaker/text) or .txt "
                         "already in 'Speaker N:' form")
    ap.add_argument("--out", default="convo.wav")
    ap.add_argument("--cfg", type=float, default=1.3,
                    help="classifier-free guidance; the demo default")
    ap.add_argument("--steps", type=int, default=10,
                    help="diffusion steps per frame")
    args = ap.parse_args()

    src = pathlib.Path(args.script)
    sections = None
    if src.suffix == ".json":
        data = json.loads(src.read_text())
        if data and isinstance(data[0], dict) and "section" in data[0]:
            # narration_v2 layout: render each section as its own pass, one
            # model load for all of them. A section is one conversation; the
            # section boundary is a scene change in the video, so a fresh
            # prosodic start there is right, not a defect.
            sections = [(s["section"], to_turns(s["turns"])) for s in data]
        else:
            text = to_turns(data)
    else:
        text = src.read_text().strip()
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    # float32: bfloat16 on MPS has bitten every model in this project so far.
    model = VibeVoiceForConditionalGenerationInference.from_pretrained(
        MODEL, torch_dtype=torch.float32, attn_implementation="sdpa",
    ).to(dev).eval()
    model.set_ddpm_inference_steps(num_steps=args.steps)
    processor = VibeVoiceProcessor.from_pretrained(MODEL)

    def render(text, path):
        n_speakers = len({ln.split(":")[0]
                          for ln in text.splitlines() if ":" in ln})
        voices = [str(REFS / f"{s}.wav") for s in SPEAKERS[:n_speakers]]
        inputs = processor(
            text=[text], voice_samples=[voices], padding=True,
            return_tensors="pt", return_attention_mask=True,
        )
        inputs = {k: (v.to(dev) if hasattr(v, "to") else v)
                  for k, v in inputs.items()}
        t0 = time.time()
        out = model.generate(
            **inputs, max_new_tokens=None, cfg_scale=args.cfg,
            tokenizer=processor.tokenizer,
            generation_config={"do_sample": False}, verbose=True,
        )
        wav = out.speech_outputs[0].float().cpu().numpy().squeeze()
        sf.write(path, wav, 24000)
        print(f"[vibe] {len(wav)/24000:.1f}s of audio in {time.time()-t0:.0f}s "
              f"-> {path}", flush=True)

    if sections:
        outdir = pathlib.Path(args.out)
        outdir.mkdir(parents=True, exist_ok=True)
        for i, (name, text) in enumerate(sections):
            path = outdir / f"{name}.wav"
            if path.exists():
                print(f"[vibe] {name} exists, skipping", flush=True)
                continue
            print(f"[vibe] section {i+1}/{len(sections)} {name}: "
                  f"{len(text.split())} words", flush=True)
            render(text, str(path))
    else:
        render(text, args.out)


if __name__ == "__main__":
    main()
