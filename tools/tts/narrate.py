#!/usr/bin/env python3
"""Stage 2 of narration: render the script in Danny's and Charlie's voices.

Chatterbox clones the reference clips minted by design_refs.py. It is here
because it holds a voice steady — median pitch across repeated renders varies
by about 5 Hz, against 22-25 Hz for Qwen VoiceDesign on identical input. Over
115 lines that is the difference between one narrator and a crowd.

Expression is not re-described per line, the way it had to be with a
description-driven model. Chatterbox exposes it directly:

    exaggeration  how much emotional emphasis to put on the read
    cfg_weight    how tightly to track the reference; lower drifts slower
                  and more deliberate, higher stays clipped and even

So a "register" here is a pair of numbers rather than a paragraph of English,
which means the difference between base and lift is reproducible instead of
re-rolled on every line.

Silence between phrases is injected rather than requested — see split_pauses.
Asking a TTS model to be brisk AND to pause makes it average the two into a
medium read with neither quality.

    tools/tts/.venv-chatterbox/bin/python tools/tts/narrate.py \
        --script narration.json --outdir audio/
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
import torchaudio
from chatterbox.tts import ChatterboxTTS

REFS = pathlib.Path(__file__).parent / "refs"

# base carries the great majority of lines; lift and hush are seasoning. If
# every line is a lift, nothing is — so base is also the default, which makes
# restraint what happens when nobody chooses.
REGISTERS = {
    "base": dict(exaggeration=0.45, cfg_weight=0.50),
    "lift": dict(exaggeration=0.75, cfg_weight=0.42),
    "hush": dict(exaggeration=0.32, cfg_weight=0.32),
}

# "spoken || spoken ||0.9 spoken" — "||" is a pause of PAUSE_DEFAULT seconds,
# "||0.9" is 0.9. The number is a suffix, not a closing delimiter: as a
# matched pair, a bare "||" never split at all, because the regex went looking
# for its closing "||" and swallowed the sentence in between.
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

    Without this an injected pause means nothing: the model leaves a variable
    head and tail on each utterance, so a fixed 0.5s gap becomes anywhere from
    0.6s to 1.3s in practice and the rhythm wanders. Trim to the speech, then
    insert exactly the silence asked for.
    """
    loud = np.where(np.abs(wav) > floor)[0]
    if len(loud) == 0:
        return wav
    keep = int(sr * keep_ms / 1000)
    return wav[max(0, loud[0] - keep): min(len(wav), loud[-1] + keep)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--outdir", default="audio")
    ap.add_argument("--pause", type=float, default=PAUSE_DEFAULT)
    ap.add_argument("--both", action="store_true",
                    help="render every line in BOTH voices, so speaker "
                         "assignment can be changed in the edit without "
                         "re-synthesising anything")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=dev)
    print(f"[narrate] chatterbox on {dev}", flush=True)

    lines = json.loads(pathlib.Path(args.script).read_text())
    outdir = pathlib.Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    def render(text, speaker, register, path):
        ref = str(REFS / f"{speaker}.wav")
        knobs = REGISTERS.get(register, REGISTERS["base"])
        pieces, sr = [], model.sr
        for seg in split_pauses(text, args.pause):
            if isinstance(seg, float):
                pieces.append(seg)
                continue
            wav = model.generate(seg, audio_prompt_path=ref, **knobs)
            pieces.append(trim_silence(wav.squeeze(0).cpu().numpy(), sr))
        audio = np.concatenate([
            np.zeros(int(p * sr), dtype=np.float32) if isinstance(p, float) else p
            for p in pieces])
        sf.write(path, audio, sr)
        return len(audio) / sr

    durations = {}
    t0 = time.time()
    for i, line in enumerate(lines):
        speakers = (["danny", "charlie"] if args.both
                    else [line.get("speaker", "charlie")])
        for sp in speakers:
            name = f"{line['id']}.{sp}" if args.both else line["id"]
            path = outdir / f"{name}.wav"
            if path.exists() and not args.force:
                durations[name] = sf.info(path).duration
                continue
            durations[name] = render(
                line["text"], sp, line.get("register", "base"), str(path))
        # The chosen take is what the video is cut to.
        chosen = line.get("speaker", "charlie")
        durations[line["id"]] = durations.get(
            f"{line['id']}.{chosen}" if args.both else line["id"], 0.0)
        done = i + 1
        rate = done / max(1e-9, (time.time() - t0) / 60)
        print(f"[narrate] {done}/{len(lines)} {line['id']} "
              f"({durations[line['id']]:.1f}s) "
              f"eta {(len(lines)-done)/max(rate,1e-9):.0f} min", flush=True)

    (outdir / "durations.json").write_text(json.dumps(durations, indent=1))
    total = sum(v for k, v in durations.items() if "." not in k)
    print(f"[narrate] {len(lines)} lines, {total/60:.1f} min of narration")
    return 0


if __name__ == "__main__":
    sys.exit(main())
