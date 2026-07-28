#!/usr/bin/env python3
"""Narrate the reel with Qwen3-TTS VoiceDesign, locally.

The difference from orpheus.py is the whole reason this exists: Orpheus picks
a voice from eight fixed speaker tokens, so the narrator's accent and manner
are whatever those eight happen to be. VoiceDesign takes the voice as a
sentence of English — region, age, warmth, pace, attitude — and synthesizes to
match. That makes "an optimistic Ohio transplant to the Bay Area, calm but
emphatic about what matters" an input rather than a wish.

The description is a prompt, not a dial, so it responds to the same things
prose responds to: concrete beats abstract, and manner-of-speaking beats
adjectives about personality. See VOICE below for the one we settled on.

    python tools/tts/qwen_voice.py --text "hello" --out hello.wav
    python tools/tts/qwen_voice.py --script narration.json --outdir audio/
"""

import argparse
import json
import pathlib
import sys
import time

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"

# The narrator. Written as behaviour rather than biography — "leans on the
# words that matter" gets a usable read, "is passionate" does not.
VOICE = (
    "A man in his thirties from Ohio who now lives in the California Bay "
    "Area. He is explaining something he finds genuinely exciting. His "
    "delivery is calm, warm and unhurried, with a clear General American "
    "accent and no regional twang. He leans into the words that matter and "
    "lets the rest sit back, the way someone does when they are sure of the "
    "idea and want you to get it too. Never breathless, never a hard sell."
)


def device():
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load(dev, model_id=MODEL):
    """float32 on MPS deliberately.

    bfloat16 halves the memory and is the documented path on CUDA, but several
    MPS kernels fall back or lose precision, and for a 1.7B model on 48GB the
    saving buys nothing. Narration quality is the only axis that matters here.
    """
    return Qwen3TTSModel.from_pretrained(
        model_id, device_map=dev,
        dtype=torch.float32 if dev == "mps" else torch.bfloat16,
        attn_implementation="sdpa")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text")
    ap.add_argument("--script", help="JSON list of {id, text} to render")
    ap.add_argument("--out", default="out.wav")
    ap.add_argument("--outdir")
    ap.add_argument("--instruct", default=VOICE)
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--force", action="store_true",
                    help="re-render lines whose wav already exists")
    args = ap.parse_args()

    dev = device()
    t0 = time.time()
    model = load(dev, args.model)
    print(f"[qwen] loaded on {dev} in {time.time()-t0:.0f}s", flush=True)

    def render(text, path):
        t = time.time()
        wavs, sr = model.generate_voice_design(
            text=text, instruct=args.instruct, language="English")
        sf.write(path, wavs[0], sr)
        dur = len(wavs[0]) / sr
        print(f"[qwen] {path}  {dur:5.1f}s  "
              f"({time.time()-t:.0f}s, {dur/(time.time()-t):.2f}x realtime)",
              flush=True)
        return dur

    if args.script:
        lines = json.loads(pathlib.Path(args.script).read_text())
        outdir = pathlib.Path(args.outdir or "audio")
        outdir.mkdir(parents=True, exist_ok=True)
        durations = {}
        for line in lines:
            path = outdir / f"{line['id']}.wav"
            if path.exists() and not args.force:
                durations[line["id"]] = sf.info(path).duration
                continue
            durations[line["id"]] = render(line["text"], str(path))
        # The durations are the point: the video is cut to them, not the
        # other way round. See tools/capture.mjs --timing.
        (outdir / "durations.json").write_text(json.dumps(durations, indent=1))
        total = sum(durations.values())
        print(f"[qwen] {len(lines)} lines, {total/60:.1f} min of narration")
    elif args.text:
        render(args.text, args.out)
    else:
        sys.exit("need --text or --script")


if __name__ == "__main__":
    main()
