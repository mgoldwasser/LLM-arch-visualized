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

import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf
import torch
import torchaudio
from chatterbox.tts import ChatterboxTTS

REFS = pathlib.Path(__file__).parent / "refs"

# Registers, deliberately WIDE.
#
# An earlier cut had these bunched at exaggeration 0.32/0.45/0.75 with the
# result that Charlie's median pitch varied by 1.5 Hz across eight lines —
# his hush and his base came out at the same pitch. That is monotone at the
# paragraph level, and it is a failure even though it looks like stability on
# a drift metric. Between-line variation that TRACKS THE CONTENT is what a
# person does; what is not wanted is variation on identical text, which is a
# different speaker each take.
#
# Measured on this model: exaggeration drives pace and pitch movement
# together — 0.45 gives ~144 wpm and 37 Hz of intonation, 0.65 gives ~165 wpm
# and 52 Hz. So the wider spread below buys speed and expression at once.
REGISTERS = {
    "hush": dict(exaggeration=0.38, cfg_weight=0.50),
    "base": dict(exaggeration=0.60, cfg_weight=0.65),
    "lift": dict(exaggeration=0.88, cfg_weight=0.60),
}

# How the two differ, given that pitch is NOT allowed to do the work: Danny is
# quicker and more animated, Charlie a touch slower and drier. Rate is a
# strong identity cue — stronger than a few Hz of pitch — and it costs nothing
# in timbre. Together with the ~100 Hz spectral-centroid gap between their
# reference clips, this is what tells them apart.
# NOTE the offsets are zero. Nudging exaggeration per speaker looked like a
# free way to make Danny livelier, but exaggeration and pitch are coupled on
# this model: +0.06 on Danny lifted his median 11 Hz and re-opened the pair to
# 41 Hz apart, undoing the closeness that took three re-casts to get. Rate is
# the differentiator precisely because it does NOT touch pitch — atempo is a
# phase vocoder. Expression is set per LINE by the register; identity is set
# per SPEAKER by tempo and by the reference clip's timbre.
# Charlie is the quicker one, which is the opposite of the first guess here.
# Measured, his reference reads at 247 wpm against Danny's 201 — and that
# matches how they were written: Ohio Danny has "an easy unhurried rhythm",
# Bay Area Charlie is "clipped and a step quicker". Pushing Danny faster to
# make him the energetic one flattened the rate difference to 5 wpm and threw
# away the only identity cue that does not touch pitch.
# Both land at ~270 wpm. Tempo is per-speaker only because their REFERENCES
# read at different speeds — Danny's at 216 wpm against Charlie's 270 — so
# equal tempo would not give equal pace. Danny's 1.28 is that ratio, not a
# character choice: the drawl was his reference clip being slow (its
# description asked for "an easy unhurried rhythm", which was a mistake) plus
# a tempo of 1.02 that barely touched it.
#
# Identity therefore no longer rests on rate at all. It rests on timbre — the
# two references differ by ~300 Hz of spectral rolloff — and on who tells
# versus who reacts, which the script controls.
TARGET_WPM = 270
SPEAKER_STYLE = {
    "danny":   dict(exag_offset=0.0, tempo=1.28),
    "charlie": dict(exag_offset=0.0, tempo=1.18),
}

# Emphasis: *word* or *short phrase*. Rendered as its own segment, slowed and
# pushed a little, with a hair of silence either side.
#
# That combination is what emphasis actually IS in speech — people do not just
# get louder, they slow down and leave a beat around the word. Doing it by
# segment also means a uniform 270 wpm elsewhere costs nothing: the read stays
# quick throughout and opens up only where the script says it should.
# Only a pause this long or longer starts a new generation. Below it the
# pause is carried by punctuation inside one continuous read and widened
# afterwards. Set high on purpose: fewer generations is better prosody.
SPLIT_AT = 0.55

# "spoken || spoken ||0.9 spoken" — "||" is a pause of PAUSE_DEFAULT seconds,
# "||0.9" is 0.9. The number is a suffix, not a closing delimiter: as a
# matched pair, a bare "||" never split at all, because the regex went looking
# for its closing "||" and swallowed the sentence in between.
PAUSE_RE = re.compile(r"\|\|(\d+(?:\.\d+)?)?")
PAUSE_DEFAULT = 0.45


def split_pauses(text, default=PAUSE_DEFAULT):
    """Split into as FEW generations as possible.

    Every split is a separate call to the model, and a phrase generated alone
    gets a terminal contour — the falling, finished shape of a whole sentence.
    That is why short fragments sounded forced: "Alright." on its own is a
    complete utterance, where a person says it leaning into what comes next.

    So splitting is now a last resort. Only a long pause (>= SPLIT_AT) starts
    a new generation, because at that length the contour really has finished.
    Everything shorter stays in one utterance, with the pause marked by
    punctuation the model already knows how to read, and then widened
    afterwards to the exact length the script asked for.

    Returns a list of floats (silence between generations) and
    (text, [(gap_seconds), ...]) tuples for each generation.
    """
    out, buf, gaps = [], [], []
    for i, part in enumerate(PAUSE_RE.split(text)):
        if i % 2:
            gap = float(part) if part else default
            if gap >= SPLIT_AT:
                if buf:
                    out.append((" ".join(buf), gaps))
                    buf, gaps = [], []
                out.append(gap)
            else:
                # Keep it in the same breath. An em dash is the strongest
                # in-sentence pause the model reads, and it is already the
                # house style in this script.
                if buf and not buf[-1].rstrip().endswith(("—", ",", ".", "!", "?", ":")):
                    buf[-1] = buf[-1].rstrip() + " —"
                gaps.append(gap)
            continue
        chunk = part.strip()
        if chunk:
            buf.append(chunk)
    if buf:
        out.append((" ".join(buf), gaps))
    return out


def mark_emphasis(text):
    """*word* -> em-dashes around the word, rather than a separate generation.

    Emphasis used to be rendered as its own segment so it could be slowed and
    pushed. That worked acoustically and was wrong prosodically: it chopped
    "That's *it*." into three utterances — "That's", "it", "." — each with its
    own complete contour. Setting the word off with dashes asks the model for
    the same thing (a beat, then weight on the word) inside a single natural
    read, which is how a person actually does it.
    """
    def sub(m):
        w = m.group(1).strip()
        return f"— {w} —"
    out = re.sub(r"\*([^*]+)\*", sub, text).replace("— —", "—")
    # "— three things —." reads as a stumble; let the sentence's own
    # punctuation close the emphasis instead.
    out = re.sub(r"\s*—\s*([.!?,;:])", r"\1", out)
    return re.sub(r"\s{2,}", " ", out).strip()


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


def retime(wav, sr, tempo):
    """Speed the read up without moving the pitch.

    Chatterbox has no rate control; exaggeration changes pace but drags
    expression along with it, so it cannot be used to set speed independently.
    ffmpeg's atempo is a phase vocoder — it changes duration and leaves pitch
    where it is — which keeps rate available as a separate dial, both for
    overall pacing and for telling the two speakers apart.
    """
    if abs(tempo - 1.0) < 0.01 or not shutil.which("ffmpeg"):
        return wav
    with tempfile.TemporaryDirectory() as d:
        src, dst = f"{d}/in.wav", f"{d}/out.wav"
        sf.write(src, wav, sr)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", src,
             "-filter:a", f"atempo={tempo:.3f}", dst],
            check=True)
        out, _ = sf.read(dst)
    return out.astype(np.float32)


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

    def widen_gaps(wav, sr, wants):
        """Re-open the pauses the model left, matching them to `wants` in order.

        Naively widening "the longest silence" once per requested pause would
        inflate the SAME gap repeatedly — after the first pass it is longer
        than the others, so it wins again. Instead: find every interior
        silence, take the N longest as the intended pause points, then sort
        those back into time order and match them one-to-one with the
        requested durations. Applied back-to-front so earlier offsets stay
        valid as the array grows.
        """
        if not wants:
            return wav
        hop = int(sr * 0.005)
        n = len(wav) // hop * hop
        if n < hop * 4:
            return wav
        env = np.abs(wav[:n]).reshape(-1, hop).max(1)
        quiet = env < 0.012
        runs, i = [], 0
        while i < len(quiet):
            if quiet[i]:
                j = i
                while j < len(quiet) and quiet[j]:
                    j += 1
                runs.append((i, j))
                i = j
            else:
                i += 1
        runs = [(a, b) for a, b in runs if a > 2 and b < len(quiet) - 2]
        if not runs:
            return wav
        # The N longest interior silences are where the punctuation landed.
        chosen = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:len(wants)])
        for (a, b), want in sorted(zip(chosen, wants), key=lambda x: -x[0][0]):
            have = (b - a) * hop / sr
            if want > have:
                pad = np.zeros(int((want - have) * sr), dtype=wav.dtype)
                wav = np.concatenate([wav[:b * hop], pad, wav[b * hop:]])
        return wav

    def render(text, speaker, register, path, lead=0.0):
        ref = str(REFS / f"{speaker}.wav")
        style = SPEAKER_STYLE.get(speaker, dict(exag_offset=0.0, tempo=1.0))
        knobs = dict(REGISTERS.get(register, REGISTERS["base"]))
        knobs["exaggeration"] = min(
            1.0, max(0.2, knobs["exaggeration"] + style["exag_offset"]))
        pieces, sr = [], model.sr
        for seg in split_pauses(mark_emphasis(text), args.pause):
            if isinstance(seg, float):
                pieces.append(seg)
                continue
            phrase, gaps = seg
            wav = model.generate(phrase, audio_prompt_path=ref, **knobs)
            seg_wav = retime(wav.squeeze(0).cpu().numpy(), sr, style["tempo"])
            seg_wav = trim_silence(seg_wav, sr)
            # Re-open the pauses the model left at the dashes, in order, to
            # the durations the script asked for.
            seg_wav = widen_gaps(seg_wav, sr, gaps)
            pieces.append(seg_wav)

        # A "lead" is silence BEFORE the line. A cut-in needs a beat in front
        # of it or it treads on the previous speaker; a continuation does not.
        # One global gap at mix time cannot tell those apart, so it lives per
        # line in the script.
        body = [np.zeros(int(p * sr), dtype=np.float32) if isinstance(p, float) else p
                for p in pieces]
        if lead > 0:
            body.insert(0, np.zeros(int(lead * sr), dtype=np.float32))
        audio = np.concatenate(body)
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
                line["text"], sp, line.get("register", "base"), str(path),
                float(line.get("lead", 0.0)))
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
