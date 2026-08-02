#!/usr/bin/env python3
"""Cut the shot list to the narration.

The reel's authored durations were placeholders — long enough to read a
caption, short enough not to bore. Once narration exists, the audio is the
master clock: every section of video must run exactly as long as its section
of audio, and each shot should be on screen while the words about it are
being spoken.

VibeVoice gives no per-turn timestamps, so alignment is reconstructed:

  1. Each shot's share of a section starts as the word count of the turns
     mapped to it (shots nobody speaks over get a nominal share — they are
     establishing shots, on screen between beats).
  2. The resulting boundaries are then snapped to the nearest detected
     silence in the audio, because a shot change during a word reads as a
     mistake, while a shot change in a breath reads as editing.

Output: timing JSON for capture.mjs --timing, one entry per shot, whose
seconds sum (per section) to the audio duration exactly.

    tools/tts/.venv-chatterbox/bin/python tools/tts/timeline.py \
        --script narration_v2.json --audio v2audio/ --out timing.json
"""

import argparse
import json
import pathlib

import numpy as np
import soundfile as sf

NOMINAL_WORDS = 12          # weight of a shot no turn is mapped to
SNAP_WINDOW = 3.0           # how far a boundary may move to find a silence
MIN_SHOT = 2.2              # never cut faster than this


def silences(wav, sr, floor=0.010, min_len=0.18):
    """Midpoints of interior quiet stretches — candidate cut points."""
    hop = int(sr * 0.01)
    n = len(wav) // hop * hop
    env = np.abs(wav[:n]).reshape(-1, hop).max(1)
    quiet = env < floor
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * hop / sr >= min_len and i > 0 and j < len(quiet):
                out.append(((i + j) / 2) * hop / sr)
            i = j
        else:
            i += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", default="timing.json")
    args = ap.parse_args()

    sections = json.loads(pathlib.Path(args.script).read_text())
    audio = pathlib.Path(args.audio)
    timing, report = [], []

    for sec in sections:
        wav, sr = sf.read(audio / f"{sec['section']}.wav")
        if wav.ndim > 1:
            wav = wav.mean(1)
        dur = len(wav) / sr
        cuts = silences(wav, sr)

        # Weight per shot: words spoken over it, else a nominal share.
        weights = []
        for shot in sec["shots"]:
            w = sum(len(t["text"].split()) for t in sec["turns"]
                    if t.get("shot") == shot)
            weights.append(max(w, NOMINAL_WORDS))
        total = sum(weights)

        # Ideal boundaries by cumulative weight, then snapped to silence.
        bounds = [0.0]
        acc = 0
        for w in weights[:-1]:
            acc += w
            ideal = dur * acc / total
            near = [c for c in cuts if abs(c - ideal) <= SNAP_WINDOW
                    and c > bounds[-1] + MIN_SHOT]
            bounds.append(min(near, key=lambda c: abs(c - ideal))
                          if near else ideal)
        bounds.append(dur)

        for shot, (a, b) in zip(sec["shots"], zip(bounds, bounds[1:])):
            timing.append({"shot": shot, "seconds": round(max(b - a, MIN_SHOT), 3)})
        report.append(f"{sec['section']:16} {dur:6.1f}s  {len(sec['shots'])} shots")

    pathlib.Path(args.out).write_text(json.dumps(timing, indent=1) + "\n")
    total = sum(t["seconds"] for t in timing)
    print("\n".join(report))
    print(f"[timeline] {len(timing)} shots, {total/60:.1f} min "
          f"-> {args.out}")


if __name__ == "__main__":
    main()
