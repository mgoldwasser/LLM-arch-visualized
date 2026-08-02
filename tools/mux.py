#!/usr/bin/env python3
"""Marry the captured video to the narration, section-exactly.

capture.mjs quantizes every shot to whole frames, so each section of video
runs a hair long or short of its section of audio — up to half a frame per
shot. Over seventeen sections in one continuous stream that drift compounds,
and by the epilogue the cut points would lead or lag the words by a visible
fraction of a second.

So instead of hoping, this reproduces capture's exact rounding (same FADE
floor, same round()) to compute each section's true video length, then pads
each section's audio with silence to precisely that length before
concatenation. The padding is at most a few hundredths of a second, spent
inside an editing pause where nothing is happening — and the sync error at
every section boundary resets to zero.

    python3 tools/mux.py --script tools/tts/narration_v2.json \
        --timing timing.json --audio v2audio/ --video reel-full.mp4 \
        --out llm-explained.mp4
"""

import argparse
import json
import pathlib
import subprocess
import tempfile

import numpy as np
import soundfile as sf

FPS = 30
FADE = round(0.45 * FPS)          # keep in lockstep with capture.mjs
MIN_FRAMES = 2 * FADE + 2


def video_seconds(shot_seconds):
    """capture.mjs's per-shot frame count, replayed."""
    return max(MIN_FRAMES, round(shot_seconds * FPS)) / FPS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--timing", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", default="llm-explained.mp4")
    args = ap.parse_args()

    sections = json.loads(pathlib.Path(args.script).read_text())
    timing = {t["shot"]: t["seconds"]
              for t in json.loads(pathlib.Path(args.timing).read_text())}
    audio_dir = pathlib.Path(args.audio)

    pieces, sr = [], None
    drift = 0.0
    for sec in sections:
        wav, sr = sf.read(audio_dir / f"{sec['section']}.wav")
        if wav.ndim > 1:
            wav = wav.mean(1)
        want = sum(video_seconds(timing[s]) for s in sec["shots"])
        have = len(wav) / sr
        pad = int(round((want - have) * sr))
        if pad > 0:
            wav = np.concatenate([wav, np.zeros(pad, dtype=wav.dtype)])
        elif pad < 0:
            # Video came up short of the audio — trim trailing silence only;
            # never cut into speech, surface it instead.
            tail = wav[pad:]
            if np.abs(tail).max() > 0.01:
                print(f"[mux] WARNING {sec['section']}: video shorter than "
                      f"speech by {-pad/sr:.2f}s — check timing")
            wav = wav[:pad]
        drift += want - have
        pieces.append(wav.astype(np.float32))
        print(f"[mux] {sec['section']:16} audio {have:7.2f}s  "
              f"video {want:7.2f}s  pad {pad/sr:+.3f}s")

    track = np.concatenate(pieces)
    print(f"[mux] narration {len(track)/sr/60:.1f} min, "
          f"net drift absorbed {drift:+.2f}s")

    with tempfile.TemporaryDirectory() as d:
        aw = f"{d}/narration.wav"
        sf.write(aw, track, sr)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y",
             "-i", args.video, "-i", aw,
             "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-shortest", args.out],
            check=True)
    out = pathlib.Path(args.out)
    print(f"[mux] wrote {out} ({out.stat().st_size/1e6:.0f} MB)")


if __name__ == "__main__":
    main()
