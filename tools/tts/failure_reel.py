#!/usr/bin/env python3
"""Stitch the voice experiments into one annotated review track.

Every experiment in this project produced audio and a number, but the numbers
only tell you what changed — not whether it helped. This assembles the whole
sequence in order, each take preceded by a spoken slate saying which
experiment it is and what went wrong with it, so the failures can be listened
to as a progression rather than remembered from a table.

The slates use macOS `say` deliberately. It is instantly available and needs
no GPU, and — more usefully — it sounds nothing like any of the candidates, so
there is never a moment of wondering whether you are hearing the label or the
experiment.

    tools/tts/.venv-chatterbox/bin/python tools/tts/failure_reel.py \
        --dir /path/to/scratchpad --out review.wav
"""

import argparse
import pathlib
import subprocess
import tempfile

import numpy as np
import soundfile as sf

SR = 24000

# (file, headline, what it taught us). Ordered as it happened.
TAKES = [
    ("voice-tara.wav", "Orpheus three B, stock voice tara",
     "First working synthesis. Eight fixed voices, so the accent could not be "
     "chosen at all."),
    ("voice-dan.wav", "Orpheus, stock voice dan",
     "Same model, different speaker token. This is the entire range of "
     "control Orpheus offers."),
    ("qwen-ohio.wav", "Qwen voice design, first description",
     "Switched models so the voice could be described in words. Asked for an "
     "optimistic Ohio transplant. Too much energy."),
    ("qwen-calm.wav", "Qwen, calmer description",
     "Dialled the enthusiasm back. Better, but every line still lands with "
     "the same weight."),
    ("v-farmer.wav", "Semi deep Ohio voice, loose script",
     "Rewrote the script to sound like someone talking, not reading. The "
     "voice held up; the delivery was uniformly expressive."),
    ("demo-mix.wav", "Three registers on one speaker",
     "Base, lift and hush. Fixed the sameness by varying the description per "
     "line instead of per project."),
    ("duo-mix.wav", "Two narrators, first attempt",
     "Danny and Charlie. Eighty four hertz apart, which is roughly an "
     "octave. A caricature, not two colleagues."),
    ("convo2-mix.wav", "Two narrators, second casting",
     "Brought them to forty hertz. Still too stark, and Danny drawled."),
    ("convo3-mix.wav", "Two narrators, third casting",
     "Twenty four hertz apart. Contrast moved from pitch into timbre. Closer, "
     "but both were slow."),
    ("convo5-mix.wav", "Faster, with wider registers",
     "Sped up and made more expressive. Side effect: raising expression "
     "raised pitch, so the pair drifted back apart to forty hertz."),
    ("sample-mix.wav", "Asymmetric dialogue",
     "Stopped alternating. One host tells, the other cuts in. Seventy three "
     "twenty seven by word count."),
    ("sample2-mix.wav", "Uniform pace, marked emphasis",
     "Both at two hundred sixty words per minute, with emphasis on chosen "
     "words. The best of the run so far."),
    ("reshape-AB3.wav", "Pitch distribution reshaping, A then B",
     "Original three lines, then the same three with the pitch contour "
     "re-skewed. Consonants left untouched after the first attempt smeared "
     "the plosives."),
    ("audition/host-warm.wav", "Podcast candidate, warm",
     "One hundred ten hertz, only twenty one hertz of pitch movement. Nearly "
     "flat."),
    ("audition/host-bright.wav", "Podcast candidate, bright",
     "One hundred fifty one hertz and ninety three of movement. The opposite "
     "failure. Each description became a caricature of its adjective."),
    ("strat/prose.wav", "Strategy test, prose about the voice",
     "Describing vocal qualities directly. Worst on pitch, second worst on "
     "movement. This is what every earlier description had been."),
    ("strat/persona.wav", "Strategy test, persona stack",
     "Podcaster, tech guy, Stanford educated, born in Ohio. No vocal "
     "adjectives at all. Best movement of any strategy."),
    ("strat/scene.wav", "Strategy test, the scene",
     "Two friends recording in a small room, mid explanation, talking across "
     "a table. The only strategy to hit all three targets."),
]


def slate(text, i, total):
    """Render one spoken label with `say`, resampled to match the takes."""
    with tempfile.TemporaryDirectory() as d:
        aiff, wav = f"{d}/s.aiff", f"{d}/s.wav"
        subprocess.run(["say", "-v", "Samantha", "-o", aiff, text], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", aiff,
                        "-ar", str(SR), "-ac", "1", wav], check=True)
        w, _ = sf.read(wav)
    # Slates sit under the takes so they never compete with what is being
    # judged.
    return (w * 0.55).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--out", default="review.wav")
    args = ap.parse_args()
    root = pathlib.Path(args.dir)

    parts, n = [], len(TAKES)
    for i, (rel, headline, lesson) in enumerate(TAKES, 1):
        path = root / rel
        if not path.exists():
            print(f"[reel] missing, skipping: {rel}")
            continue
        parts.append(slate(f"Experiment {i}. {headline}. {lesson}", i, n))
        parts.append(np.zeros(int(SR * 0.45), dtype=np.float32))

        w, sr = sf.read(path)
        if w.ndim > 1:
            w = w.mean(1)
        if sr != SR:
            # Resample by linear interpolation — these are review copies, and
            # a proper resampler is not worth a dependency here.
            idx = np.linspace(0, len(w) - 1, int(len(w) * SR / sr))
            w = np.interp(idx, np.arange(len(w)), w)
        peak = np.abs(w).max()
        if peak > 0:
            w = w / peak * 0.85          # level the takes against each other
        parts.append(w.astype(np.float32))
        parts.append(np.zeros(int(SR * 1.0), dtype=np.float32))
        print(f"[reel] {i:2d}. {headline}  ({len(w)/SR:.0f}s)")

    out = np.concatenate(parts)
    sf.write(args.out, out, SR)
    print(f"[reel] wrote {args.out} — {len(out)/SR/60:.1f} min")


if __name__ == "__main__":
    main()
