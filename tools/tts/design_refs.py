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
SPEAKERS = {
    # Ohio. Warm, rounded, even.
    "danny": (
        "A man in his late thirties from Ohio. An ordinary adult man's "
        "speaking voice in the middle of its range — neither high nor deep. "
        "Warm, rounded and friendly, relaxed and even, with an easy unhurried "
        "rhythm and natural rising and falling intonation. General American "
        "with only the faintest Midwestern colour; no strong regional accent, "
        "nothing exaggerated."),
    # Bay Area. Drier, flatter, quicker.
    "charlie": (
        "A man in his late thirties from the California Bay Area. An ordinary "
        "adult man's speaking voice in the middle of its range — neither high "
        "nor deep. Dry, flat and matter-of-fact rather than warm, a little "
        "gravelly, slightly clipped and a step quicker, with natural rising "
        "and falling intonation. Standard California General American; no "
        "strong regional accent, nothing exaggerated."),
}

# What we actually care about is the GAP, not either absolute pitch — that is
# the quantity a listener reacts to. Picking each voice independently against
# its own target left the separation to chance, and it landed at 84, then 40.
# Targeted at the REFERENCE, not at the finished narration. Expression lifts
# pitch — widening the registers for liveliness took a 24.6 Hz gap out to 39.9
# — so the references have to start closer than the number we actually want to
# hear. 10 Hz here lands near 25 once the registers do their work.
TARGET_GAP = 10.0
GAP_MIN, GAP_MAX = 5.0, 22.0
# Both should still land in a plausible adult male speaking range.
RANGE_OK = (95.0, 155.0)


def pitch(wav, sr):
    """(median, internal spread) of voiced pitch.

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
        return float("nan"), float("inf")
    # Interquartile range, not std: robust to the odd octave-error frame.
    return float(np.median(v)), float(np.subtract(*np.percentile(v, [75, 25])))


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

    Independent selection optimised each voice against its own pitch target
    and let the gap between them fall where it may. Since the gap is the thing
    that reads as "two people" or "a double act", it is what gets optimised
    here instead: score every candidate pairing on how close its separation is
    to TARGET_GAP, requiring only that both voices land somewhere plausible
    and that Danny is the higher of the two.
    """
    pool = {}
    for name, description in SPEAKERS.items():
        takes = []
        for _ in range(8):
            wavs, sr = model.generate_voice_design(
                text=REF_TEXT, instruct=description, language="English")
            med, iqr = pitch(wavs[0], sr)
            takes.append((med, iqr, wavs[0], sr))
        pool[name] = takes
        print(f"[refs] {name:8} takes: "
              + ", ".join(f"{t[0]:.0f}" for t in takes), flush=True)

    best = None
    for d in pool["danny"]:
        for c in pool["charlie"]:
            gap = d[0] - c[0]                      # signed: danny above
            if gap <= 0:
                continue
            if not (RANGE_OK[0] <= d[0] <= RANGE_OK[1]):
                continue
            if not (RANGE_OK[0] <= c[0] <= RANGE_OK[1]):
                continue
            # Prefer the intended gap; break ties toward livelier references,
            # since within-line range is intonation and we want it.
            score = abs(gap - TARGET_GAP) - 0.05 * (d[1] + c[1])
            if best is None or score < best[0]:
                best = (score, d, c, gap)

    if best is None:
        print("[refs] no candidate pair landed in range — re-run")
        return 1

    _, d, c, gap = best
    pitches = {}
    for name, take in (("danny", d), ("charlie", c)):
        sf.write(OUT / f"{name}.wav", take[2], take[3])
        pitches[name] = take[0]
        print(f"[refs] {name:8} chose {take[0]:5.1f} Hz "
              f"(intonation range {take[1]:4.1f}) -> {OUT / (name + '.wav')}")

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
