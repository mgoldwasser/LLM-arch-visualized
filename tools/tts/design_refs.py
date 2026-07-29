#!/usr/bin/env python3
"""Stage 1 of narration: mint one reference clip per speaker.

Qwen3-TTS VoiceDesign is the only model here that can turn a SENTENCE about a
voice — "a man from rural Ohio, semi-deep and resonant, cheerful" — into that
voice. That is why it is in the pipeline. What it cannot do is say the same
voice twice: rendering one identical sentence four times gave median pitches
of 112, 147, 124 and 169 Hz, and cloning from its own output did not help
(133, 194, 148, 131). Across 115 narration lines that is not one narrator, it
is a room full of strangers.

So VoiceDesign is used exactly once per speaker, to mint a reference. Stage 2
(narrate.py) clones that reference with Chatterbox, which holds a voice to a
~5 Hz spread. Design the voice with the model that can design; hold it with
the model that can hold.

The references are small and are committed, so re-rendering narration later
does not re-roll the cast.

    tools/tts/.venv/bin/python tools/tts/design_refs.py
"""

import pathlib
import sys

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
OUT = pathlib.Path(__file__).parent / "refs"

# What the reference clip says. Chatterbox takes the timbre from this, so it
# wants a plain, level, mid-register read — no questions, no exclamation, and
# nothing at the edge of the speaker's range. Expression comes later, per
# line; baking it in here would tint all 115 lines with it.
REF_TEXT = ("The model reads the whole sentence at once, and weighs every "
            "word against every other word. That is the part worth "
            "understanding, and it is simpler than it sounds.")

# Two men in their late thirties, close enough in pitch to be plausible
# colleagues and different enough in texture to be told apart. An earlier cut
# put them 84 Hz apart, which is not contrast but caricature — nobody hears
# two adults explaining something and thinks "one of them is a cartoon". The
# separation now lives in timbre (warm and round against dry and level)
# rather than in pitch, and the targets below are only ~35 Hz apart.
#
# Accents are held deliberately faint. Both are General American; the region
# shows in phrasing far more than in vowels, which is why the SCRIPT carries
# the dialect (see docs) and the description asks for "no strong regional
# accent". Ask a TTS model for a Midwestern accent and it will give you a
# costume.
# Both men sit in an ordinary adult male speaking range, close together. The
# difference between them is TEXTURE and PACE, not pitch: one warm and
# rounded and even, the other drier and flatter and a step quicker. Earlier
# cuts separated them by 84 Hz and then 40 — roughly an octave and then a
# fifth — and both read as a double act rather than as two colleagues.
#
# Neither description names a voice type any more. "Tenor" and "baritone"
# were what pulled them apart; asking for two ordinary men and distinguishing
# them by manner keeps the gap small without making them the same person.
# One balanced description per speaker, plus selection against measured
# targets. Six single-adjective descriptions were auditioned — warm, dry,
# gravelly, storytelling, bright, quick — and every one over-committed to its
# adjective: "bright" gave 151 Hz and a 93 Hz pitch range, "warm" gave 110 Hz
# and 21. The description is a prompt, so naming one quality loudly gets a
# caricature of it.
#
# So the wording below deliberately holds several qualities at once and none
# of them hard, and the TARGETS do the rest. Generating a pool and selecting
# on measurement is far more reliable than trying to write a paragraph that
# lands on 125 Hz.
#
# Naming the CONTEXT still does the heavy lifting: "recording a conversational
# podcast in a small studio" carries mic distance, pace and register together
# in a way that a list of adjectives does not.
_BASE = (
    "A man in his late thirties recording a conversational podcast in a "
    "small studio, mid-conversation and thinking out loud. Natural, "
    "close-mic'd voice with a little texture in it — lived-in, not polished, "
    "no announcer quality at all. His delivery moves with what he is saying: "
    "quicker through the familiar parts, slowing on the thing that matters. "
    "His pitch moves a lot while he talks — he lifts into a phrase, leans on "
    "the word that carries it, and drops away at the end of a thought. "
    "Expressive and melodic, never flat or level, but never performed "
    "either. Brisk overall. Clear General American accent. ")

SPEAKERS = {
    # The teller. Rounder, a touch lower, carries the long stretches.
    "danny": _BASE + (
        "Slightly rounder and warmer in tone, and comfortable holding the "
        "floor for a while."),
    # The reactor. Drier and a little more clipped, comes in on top.
    "charlie": _BASE + (
        "Slightly drier and more clipped in tone, with a quick step to it."),
}

# The windows to select into. A candidate inside a window scores zero on it;
# outside, it is penalised by how far out it is. Ranges rather than points,
# because these three interact — pushing pitch range up tends to drag pitch
# and pace with it — and a point target on all three has no solutions.
TARGETS = {
    "pitch": (110.0, 140.0),      # Hz, median
    "range": (40.0, 70.0),        # Hz, interquartile — how much the voice moves
    # Pace is measured and reported but only lightly scored: atempo corrects
    # rate downstream without touching pitch, so rejecting an otherwise-good
    # reference for being slow throws away a candidate for a problem that is
    # already solved. Pitch and pitch RANGE are the ones that must come from
    # the model, because nothing downstream can add movement that is not
    # there.
    "wpm":   (240.0, 330.0),
}
# Still want them distinguishable, but the separation now comes mostly from
# timbre and manner, so this is a light preference rather than a hard target.
TARGET_GAP = 14.0
GAP_MIN, GAP_MAX = 4.0, 30.0


def pitch(wav, sr, nwords=None):
    """(median, internal spread, words-per-minute) of a candidate.

    The spread is REPORTED but deliberately not penalised. Within-line pitch
    range is intonation — it is what stops a read being monotone — and an
    earlier version of this scoring treated it as a defect, which selected
    flat takes, pulled Danny 40 Hz below his target and collapsed the two
    speakers to 11 Hz apart. The instability worth fixing is drift in the
    MEDIAN between lines, which is a different quantity in the same units and
    is handled by cfg_weight in narrate.py, not here.
    """
    import torchaudio.functional as F
    p = F.detect_pitch_frequency(
        torch.tensor(wav, dtype=torch.float32), sr,
        freq_low=60, freq_high=350).numpy()
    v = p[(p > 60) & (p < 350)]
    if not len(v):
        return float("nan"), float("inf"), float("nan")
    hop = int(sr * 0.01)
    n = len(wav) // hop * hop
    env = np.abs(np.asarray(wav)[:n]).reshape(-1, hop).max(1)
    speech = (env > 0.015).sum() * hop / sr
    wpm = (nwords or len(REF_TEXT.split())) / max(speech, 1e-6) * 60
    # Interquartile range, not std: robust to the odd octave-error frame.
    return (float(np.median(v)),
            float(np.subtract(*np.percentile(v, [75, 25]))),
            float(wpm))


def main():
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Qwen3TTSModel.from_pretrained(
        MODEL, device_map=dev,
        dtype=torch.float32 if dev == "mps" else torch.bfloat16,
        # eager, not sdpa: the MPS sdpa kernel aborts the whole process on
        # this model's grouped-query attention once the prompt is long enough
        # ("mps_matmul ... incompatible dimensions", 16 query heads against 8
        # KV heads). Eager is slower and this stage runs twice, ever.
        attn_implementation="eager")
    OUT.mkdir(parents=True, exist_ok=True)

    """Generate a pool per speaker, then choose the PAIR.

    Scored on three windows at once — pitch, pitch range and pace — plus the
    gap between the two speakers. Selection does the work the description
    cannot: a prompt cannot be aimed at 125 Hz, but twelve rolls and a scorer
    can be.
    """
    def miss(x, lo, hi):
        return 0.0 if lo <= x <= hi else (lo - x if x < lo else x - hi)

    def score_one(med, rng, wpm):
        return (miss(med, *TARGETS["pitch"]) / 30.0
                + miss(rng, *TARGETS["range"]) / 20.0     # weighted hardest
                + miss(wpm, *TARGETS["wpm"]) / 200.0)     # barely counts

    pool = {}
    for name, description in SPEAKERS.items():
        takes = []
        for _ in range(12):
            wavs, sr = model.generate_voice_design(
                text=REF_TEXT, instruct=description, language="English")
            med, rng, wpm = pitch(wavs[0], sr)
            takes.append((med, rng, wpm, wavs[0], sr))
        pool[name] = takes
        inside = sum(1 for t in takes if score_one(t[0], t[1], t[2]) == 0)
        print(f"[refs] {name:8} pool: "
              + ", ".join(f"{t[0]:.0f}/{t[1]:.0f}/{t[2]:.0f}" for t in takes)
              + f"   ({inside}/12 inside all three windows)", flush=True)

    best = None
    for d in pool["danny"]:
        for c in pool["charlie"]:
            gap = d[0] - c[0]
            if gap <= 0:
                continue
            sc = (score_one(d[0], d[1], d[2]) + score_one(c[0], c[1], c[2])
                  + abs(gap - TARGET_GAP) / 40.0)
            if best is None or sc < best[0]:
                best = (sc, d, c, gap)

    if best is None:
        print("[refs] no candidate pair with danny above charlie — re-run")
        return 1

    _, d, c, gap = best
    pitches = {}
    for name, take in (("danny", d), ("charlie", c)):
        sf.write(OUT / f"{name}.wav", take[3], take[4])
        pitches[name] = take[0]
        print(f"[refs] {name:8} chose pitch {take[0]:5.1f}  range {take[1]:5.1f}  "
              f"{take[2]:5.0f} wpm")

    print(f"[refs] separation {gap:.1f} Hz (target {TARGET_GAP:.0f})")
    # Bounded on BOTH sides. Too close and they are one person; too far and
    # they are a double act, which is the failure this cast was retuned to fix.
    if gap < GAP_MIN:
        print(f"[refs] WARNING: under {GAP_MIN:.0f} Hz — one person. Re-run.")
        return 1
    if gap > GAP_MAX:
        print(f"[refs] WARNING: over {GAP_MAX:.0f} Hz — reads as a double act "
              "rather than two colleagues. Re-run.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
