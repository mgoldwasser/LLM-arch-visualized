#!/usr/bin/env python3
"""Search description space for a voice, instead of writing one and hoping.

Everything so far has been hand-authored prompts checked by ear. That does not
converge: six adjective-led descriptions each returned a caricature of their
adjective, and a deliberately balanced rewrite put 0 of 12 rolls inside the
target windows — all of them too low, too flat and too slow at once.

The reason is that a voice description is a prompt, and nobody can predict
what a prompt will do to 125 Hz of median pitch. So stop predicting. Hold a
target — either numbers, or measurements taken from a voice you like — and
hill-climb over description FRAGMENTS, scoring each candidate by generating
audio and measuring it.

Using VoiceDesign itself as the judge is the point. An audio-captioning model
could describe a target voice in words, but they would be ITS words: accurate
captions drawn from its own training distribution, with no guarantee that
VoiceDesign responds to any of them. Here the scoring function is the same
model that will render the narration, so every phrase that survives is a
phrase it demonstrably reacts to.

    # aim at explicit numbers
    tools/tts/.venv/bin/python tools/tts/search_voice.py \
        --pitch 125 --range 55 --wpm 300

    # or aim at a voice you like — measured, never sampled: nothing from
    # this file reaches the output, only four numbers taken off it
    tools/tts/.venv/bin/python tools/tts/search_voice.py --like ref.wav
"""

import argparse
import json
import pathlib
import random

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"

LINE = ("Okay so here's the part that got me. Every token looks at every "
        "other token, all at once — and nobody told it to do that. It just "
        "turned out to be the thing that worked.")

# The search space. Each slot contributes one phrase; a description is one
# choice from each. Slots are grouped by what they plausibly control, so the
# search can move along one axis at a time rather than rewriting the whole
# prompt every step.
SLOTS = {
    "who": [
        "A man in his late thirties.",
        "A man in his early forties.",
        "Podcaster, tech guy, Stanford educated, lives in Silicon Valley, "
        "born and raised in Ohio, late thirties.",
        "A guy who hosts a technology podcast, mid-thirties, from the Midwest "
        "originally, in California now.",
    ],
    "setting": [
        "Recording a conversational podcast in a small studio.",
        "Mid-conversation with a friend across a table.",
        "Talking someone through something on his laptop screen.",
        "",
    ],
    "timbre": [
        "Natural close-mic'd voice with a little texture in it, not polished.",
        "Slightly gravelly, lived-in voice.",
        "Warm and round, comfortable in its middle register.",
        "Clear and even, no announcer quality at all.",
    ],
    "movement": [
        "His pitch moves a lot while he talks — he lifts into a phrase, leans "
        "on the word that carries it, and drops away at the end of a thought.",
        "Expressive and melodic, with real dynamic range.",
        "He emphasises words mid-sentence and lets others fall away.",
        "Even and level in delivery.",
    ],
    "pace": [
        "Brisk.",
        "Quick, a little jumpy, thinking out loud as he goes.",
        "Unhurried but never slow.",
        "",
    ],
    "accent": [
        "Clear General American accent.",
        "Standard American accent, faint Midwestern colour, nothing "
        "exaggerated.",
    ],
    "negative": [
        "Not a broadcaster, not reading, not performed.",
        "",
    ],
}


def measure(wav, sr, nwords):
    import torchaudio.functional as F
    p = F.detect_pitch_frequency(
        torch.tensor(wav, dtype=torch.float32), sr,
        freq_low=60, freq_high=350).numpy()
    v = p[(p > 60) & (p < 350)]
    if not len(v):
        return None
    hop = int(sr * 0.01)
    n = len(wav) // hop * hop
    env = np.abs(np.asarray(wav)[:n]).reshape(-1, hop).max(1)
    speech = (env > 0.015).sum() * hop / sr
    n2 = len(wav) // 1024 * 1024
    S = np.abs(np.fft.rfft(np.asarray(wav)[:n2].reshape(-1, 1024), axis=1))
    fr = np.fft.rfftfreq(1024, 1 / sr)
    cen = float(np.median((S * fr).sum(1) / np.maximum(S.sum(1), 1e-9)))
    return dict(pitch=float(np.median(v)),
                range=float(np.subtract(*np.percentile(v, [75, 25]))),
                wpm=nwords / max(speech, 1e-6) * 60,
                centroid=cen)


def build(choice):
    return " ".join(SLOTS[k][i] for k, i in choice.items() if SLOTS[k][i])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pitch", type=float, default=125.0)
    ap.add_argument("--range", type=float, default=55.0)
    ap.add_argument("--wpm", type=float, default=300.0)
    ap.add_argument("--like", help="wav to take target measurements from")
    ap.add_argument("--steps", type=int, default=40)
    ap.add_argument("--takes", type=int, default=2)
    ap.add_argument("--out", default="voice-search.json")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Qwen3TTSModel.from_pretrained(
        MODEL, device_map=dev,
        dtype=torch.float32 if dev == "mps" else torch.bfloat16,
        attn_implementation="eager")   # MPS sdpa aborts on this model's GQA

    nw = len(LINE.split())
    target = dict(pitch=args.pitch, range=args.range, wpm=args.wpm)
    if args.like:
        w, sr = sf.read(args.like)
        m = measure(w, sr, len(LINE.split()))
        if m:
            target = dict(pitch=m["pitch"], range=m["range"], wpm=m["wpm"])
        print(f"[search] target from {args.like}: "
              + ", ".join(f"{k} {v:.0f}" for k, v in target.items()))

    def cost(m):
        """Relative error, so the three axes are comparable.

        Pitch range is weighted double: it is the one quality nothing
        downstream can add. Pace is weighted lightly because atempo fixes it
        afterwards without touching pitch.
        """
        return (abs(m["pitch"] - target["pitch"]) / target["pitch"]
                + 2.0 * abs(m["range"] - target["range"]) / max(target["range"], 1)
                + 0.25 * abs(m["wpm"] - target["wpm"]) / target["wpm"])

    def evaluate(choice):
        """Average over takes — VoiceDesign is unstable, so one roll would
        score luck rather than the description."""
        ms = []
        for _ in range(args.takes):
            wavs, sr = model.generate_voice_design(
                text=LINE, instruct=build(choice), language="English")
            m = measure(wavs[0], sr, nw)
            if m:
                ms.append((m, wavs[0], sr))
        if not ms:
            return float("inf"), None
        avg = {k: float(np.mean([m[0][k] for m in ms])) for k in ms[0][0]}
        best = min(ms, key=lambda x: cost(x[0]))
        return cost(avg), (avg, best[1], best[2])

    rng = random.Random(args.seed)
    cur = {k: 0 for k in SLOTS}
    cur_cost, cur_info = evaluate(cur)
    print(f"[search] start cost {cur_cost:.3f}  "
          + ", ".join(f"{k} {v:.0f}" for k, v in cur_info[0].items()), flush=True)

    best = (cur_cost, dict(cur), cur_info)
    for step in range(args.steps):
        """One slot at a time.

        Changing the whole description each step makes it impossible to learn
        which phrase did the work — and with a noisy objective, impossible to
        keep. Single-slot moves make every accepted change attributable.
        """
        k = rng.choice(list(SLOTS))
        cand = dict(cur)
        options = [i for i in range(len(SLOTS[k])) if i != cur[k]]
        if not options:
            continue
        cand[k] = rng.choice(options)
        c, info = evaluate(cand)
        keep = c < cur_cost
        print(f"[search] {step+1:3d}/{args.steps} {k:9} -> {c:.3f} "
              f"{'accept' if keep else 'reject'}"
              + (f"  ({', '.join(f'{a} {b:.0f}' for a, b in info[0].items())})"
                 if info else ""), flush=True)
        if keep:
            cur, cur_cost, cur_info = cand, c, info
            if c < best[0]:
                best = (c, dict(cand), info)

    cost_, choice, info = best
    desc = build(choice)
    sf.write("voice-search.wav", info[1], info[2])
    pathlib.Path(args.out).write_text(json.dumps(
        {"cost": cost_, "description": desc, "measured": info[0],
         "target": target}, indent=1) + "\n")
    print(f"\n[search] best cost {cost_:.3f}")
    print(f"[search] measured: "
          + ", ".join(f"{k} {v:.0f}" for k, v in info[0].items()))
    print(f"[search] description:\n{desc}")


if __name__ == "__main__":
    main()
