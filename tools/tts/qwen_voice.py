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
import re
import sys
import time

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"

# The narrator. Written as behaviour rather than biography — "leans on the
# words that matter" gets a usable read, "is passionate" does not.
#
# Note what this does NOT ask for: pauses. Asking a TTS model to be brisk AND
# to pause is asking it to hold two opposite tempos at once, and it splits the
# difference — an even, medium read with neither quality. So the description
# asks only for pace and attitude, and the silence is placed afterwards by
# PAUSE markers in the text (see split_pauses). Model does delivery; we do
# timing.
# Two narrators, three registers each.
#
# One description applied to every line is what makes TTS narration tiring:
# the model gives every sentence the same emotional weight, so a definition
# and a punchline arrive at identical intensity and the whole thing reads as
# performed. Real explanation has dynamics. Two voices give it a second axis —
# a change of speaker is a change of pace that costs the listener nothing.
#
# Danny runs hot: quicker, brighter, the one who is delighted by a result.
# Charlie runs deep: slower, richer, the one who tells you why it matters.
# Neither is subtle, neither is overdone. They are cast against the material —
# Danny for the mechanism and the payoff, Charlie for the stakes and the
# turns — rather than alternating on a schedule.
SPEAKERS = {
    "danny": (
        "A man in his late twenties from Ohio, now in the California Bay "
        "Area. Bright, buoyant, slightly higher-pitched voice with a quick "
        "step to it. Natural and a little unpolished, not a broadcaster. "
        "Clear General American accent. Infectiously into this stuff. "),
    "charlie": (
        "A man in his forties from rural Ohio, now in the California Bay "
        "Area. Deep, resonant, unhurried voice with real warmth and a bit of "
        "gravel in it. Natural and grounded, not a broadcaster. Clear "
        "General American accent. He cares about this material and it shows. "),
}

# Modifiers, appended to whichever speaker is talking. base carries the great
# majority; lift and hush are seasoning. If every line is a lift, nothing is.
REGISTERS = {
    "base": ("He is explaining how something works, clearly and steadily, at "
             "a comfortable pace. Matter-of-fact and friendly — talking a "
             "friend through something on his laptop, not performing."),
    "lift": ("He lights up here — faster and brighter, genuinely delighted by "
             "what he is pointing at, the way someone sounds when the thing "
             "finally clicks. Still natural, never a sales pitch."),
    "hush": ("He slows and quietens here, giving a single idea room to land. "
             "Deliberate and a little lower, letting the words carry the "
             "weight instead of the delivery."),
}

def voice_of(speaker, register):
    return SPEAKERS[speaker] + REGISTERS.get(register, REGISTERS["base"])

VOICE = voice_of("charlie", "base")

# "spoken || spoken ||0.9 spoken" — "||" is a pause of PAUSE_DEFAULT seconds,
# "||0.9" is a pause of 0.9. The number is a suffix, not a closing delimiter:
# making it a matched pair meant a bare "||" never split, since the regex
# looked for a second "||" and swallowed the sentence between them.
PAUSE_RE = re.compile(r"\|\|(\d+(?:\.\d+)?)?")
PAUSE_DEFAULT = 0.45


def split_pauses(text, default=PAUSE_DEFAULT):
    """['spoken', 0.6, 'spoken', ...] — segments and the silence between."""
    parts = PAUSE_RE.split(text)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            if part.strip():
                out.append(part.strip())
        else:
            out.append(float(part) if part else default)
    return out


def trim_silence(wav, sr, floor=0.008, keep_ms=30):
    """Strip the model's own leading/trailing silence.

    Necessary for injected pauses to mean anything. Qwen leaves a variable
    head and tail on every utterance — sometimes 50ms, sometimes 400 — so
    concatenating raw segments with a fixed 0.5s gap produces gaps that are
    actually anywhere from 0.6s to 1.3s, and the rhythm wanders. Trim to the
    speech, then insert exactly the silence asked for.
    """
    amp = np.abs(wav)
    loud = np.where(amp > floor)[0]
    if len(loud) == 0:
        return wav
    keep = int(sr * keep_ms / 1000)
    return wav[max(0, loud[0] - keep): min(len(wav), loud[-1] + keep)]


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
    ap.add_argument("--instruct", default=VOICE,
                    help="override the register system entirely")
    ap.add_argument("--speaker", default="charlie", choices=sorted(SPEAKERS))
    ap.add_argument("--register", default="base",
                    choices=sorted(REGISTERS), help="for --text")
    ap.add_argument("--pause", type=float, default=PAUSE_DEFAULT,
                    help="seconds for a bare || marker")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--force", action="store_true",
                    help="re-render lines whose wav already exists")
    args = ap.parse_args()

    dev = device()
    t0 = time.time()
    model = load(dev, args.model)
    print(f"[qwen] loaded on {dev} in {time.time()-t0:.0f}s", flush=True)

    def render(text, path, speaker="charlie", register="base"):
        t = time.time()
        instruct = (args.instruct if args.instruct != VOICE
                    else voice_of(speaker, register))
        pieces, sr = [], None
        for seg in split_pauses(text, args.pause):
            if isinstance(seg, float):
                # Placeholder; filled once sr is known from the first segment.
                pieces.append(seg)
                continue
            wavs, sr = model.generate_voice_design(
                text=seg, instruct=instruct, language="English")
            pieces.append(trim_silence(wavs[0], sr))
        if sr is None:
            raise ValueError("nothing to speak")
        audio = np.concatenate([
            np.zeros(int(p * sr), dtype=np.float32) if isinstance(p, float) else p
            for p in pieces])
        sf.write(path, audio, sr)
        dur = len(audio) / sr
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
            durations[line["id"]] = render(
                line["text"], str(path),
                line.get("speaker", "charlie"), line.get("register", "base"))
        # The durations are the point: the video is cut to them, not the
        # other way round. See tools/capture.mjs --timing.
        (outdir / "durations.json").write_text(json.dumps(durations, indent=1))
        total = sum(durations.values())
        print(f"[qwen] {len(lines)} lines, {total/60:.1f} min of narration")
    elif args.text:
        render(args.text, args.out, args.speaker, args.register)
    else:
        sys.exit("need --text or --script")


if __name__ == "__main__":
    main()
