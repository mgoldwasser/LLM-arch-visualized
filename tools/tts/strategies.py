#!/usr/bin/env python3
"""Compare PROMPTING STRATEGIES for a voice, not just prompt wording.

The six-adjective audition showed that how a description is written matters
more than what it says: each one returned a caricature of whichever quality it
named loudest. That suggests the failure is structural — the format of the
prompt, not the vocabulary — so this tests formats against each other with the
content held as close to constant as it can be.

Five ways of asking for the same narrator:

    prose     descriptive sentences about the voice itself
    persona   terse identity stacking, no vocal adjectives at all
    scene     the recording situation, letting voice follow from context
    analogy   what the delivery is LIKE, by comparison to an activity
    direction screenplay-style performance notes in brackets

Each is rendered several times on the same line and reported as median pitch,
pitch range and pace, against the targets we are aiming for. Multiple takes
matter because VoiceDesign is unstable between calls — a single roll would
compare luck rather than strategy.

    tools/tts/.venv/bin/python tools/tts/strategies.py --outdir /tmp/strat
"""

import argparse
import pathlib

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"

LINE = ("Okay so here's the part that got me. Every token looks at every "
        "other token, all at once — and nobody told it to do that. It just "
        "turned out to be the thing that worked.")

TARGET = {"pitch": (110, 140), "range": (40, 70), "wpm": (280, 320)}

STRATEGIES = {
    "prose": (
        "A man in his late thirties with a natural, close-mic'd voice, a "
        "little lived-in and not polished. His pitch moves a lot while he "
        "talks — he lifts into a phrase, leans on the word that carries it, "
        "and drops away at the end of a thought. Brisk. Clear General "
        "American accent."),

    # The user's suggestion: identity markers only, no vocal adjectives.
    "persona": (
        "Podcaster, tech guy, Stanford educated, lives in Silicon Valley, "
        "born and raised in Ohio, late thirties."),

    "scene": (
        "Two friends recording a podcast in a small room, one of them "
        "halfway through explaining something he is enjoying explaining. "
        "He is talking to the person across the table, not to a microphone, "
        "and he has had a coffee."),

    "analogy": (
        "He talks the way someone talks when they are showing you something "
        "on their laptop screen and they cannot wait for you to see the next "
        "bit — quick, a little jumpy, emphasising words mid-sentence, "
        "trailing off and picking the thread back up."),

    "direction": (
        "[male, late 30s, American] [conversational, mid-thought, leaning in] "
        "[pace: brisk] [pitch: moves freely, wide melodic range] "
        "[tone: warm, unpolished, real] [not: announcer, narrator, read aloud]"),
}


def measure(wav, sr, nwords):
    import torchaudio.functional as F
    p = F.detect_pitch_frequency(
        torch.tensor(wav, dtype=torch.float32), sr,
        freq_low=60, freq_high=350).numpy()
    v = p[(p > 60) & (p < 350)]
    if not len(v):
        return float("nan"), float("nan"), float("nan")
    hop = int(sr * 0.01)
    n = len(wav) // hop * hop
    env = np.abs(wav[:n]).reshape(-1, hop).max(1)
    speech = (env > 0.015).sum() * hop / sr
    return (float(np.median(v)),
            float(np.subtract(*np.percentile(v, [75, 25]))),
            nwords / max(speech, 1e-6) * 60)


def hits(med, rng, wpm):
    ok = lambda x, k: TARGET[k][0] <= x <= TARGET[k][1]
    return sum([ok(med, "pitch"), ok(rng, "range"), ok(wpm, "wpm")])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="strategies")
    ap.add_argument("--takes", type=int, default=4)
    args = ap.parse_args()

    out = pathlib.Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Qwen3TTSModel.from_pretrained(
        MODEL, device_map=dev,
        dtype=torch.float32 if dev == "mps" else torch.bfloat16,
        attn_implementation="eager")   # MPS sdpa aborts on this model's GQA

    nw = len(LINE.split())
    print(f"targets: pitch {TARGET['pitch']}  range {TARGET['range']}  "
          f"wpm {TARGET['wpm']}")
    print(f"{'strategy':11}{'pitch':>14}{'range':>14}{'wpm':>14}{'best':>7}")
    for name, desc in STRATEGIES.items():
        rows = []
        for i in range(args.takes):
            wavs, sr = model.generate_voice_design(
                text=LINE, instruct=desc, language="English")
            m, r, w = measure(wavs[0], sr, nw)
            rows.append((m, r, w, wavs[0], sr))
        # Keep the take that satisfies the most windows, so the comparison is
        # "what can this strategy reach", not "what did it happen to roll".
        rows.sort(key=lambda t: (-hits(t[0], t[1], t[2]), -t[1]))
        best = rows[0]
        sf.write(out / f"{name}.wav", best[3], best[4])
        med = lambda i: np.median([r[i] for r in rows])
        print(f"{name:11}"
              f"{med(0):7.0f} (med){med(1):9.0f} (med){med(2):9.0f} (med)"
              f"{hits(best[0], best[1], best[2]):5d}/3", flush=True)


if __name__ == "__main__":
    main()
