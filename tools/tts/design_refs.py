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
SPEAKERS = {
    # Ohio. A light, clear adult tenor — "bright and buoyant" read as goofy at
    # 183 Hz, but dropping that language entirely sent him to 116, which is
    # Charlie's register. The wording below asks for the top of an ordinary
    # man's range while explicitly ruling out boyish.
    "danny": (
        "A man in his late thirties from Ohio with a light, clear tenor "
        "voice — the higher end of an ordinary adult man's speaking range, "
        "but relaxed and grounded, never boyish, never squeaky, never "
        "cartoonish. Warm, friendly and even, with an easy unhurried rhythm "
        "and natural rising and falling intonation. General American with "
        "only the faintest Midwestern colour; no strong regional accent."),
    # Bay Area. Genuinely low, to open the gap from the other side rather
    # than pushing Danny higher again.
    "charlie": (
        "A man in his late thirties from the California Bay Area with a low, "
        "resonant baritone — deep and chesty, with a little gravel in it. Dry "
        "and matter-of-fact rather than warm, slightly clipped, with a "
        "quicker step and natural rising and falling intonation. Standard "
        "California General American; no strong regional accent."),
}

# Close together on purpose. See the note above.
TARGETS = {"danny": 148.0, "charlie": 102.0}


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

    pitches = {}
    for name, description in SPEAKERS.items():
        """Several takes, keep the one nearest the speaker's intended pitch.

        VoiceDesign's instability is the reason this stage exists, and it
        applies to the reference too — one roll might hand back a Danny who
        sounds like Charlie. Generating a few and choosing on measured pitch
        turns that variance from a risk into a selection.
        """
        takes = []
        for i in range(8):
            wavs, sr = model.generate_voice_design(
                text=REF_TEXT, instruct=description, language="English")
            med, iqr = pitch(wavs[0], sr)
            takes.append((med, iqr, wavs[0], sr))
        target = TARGETS[name]
        # Median proximity only. A take with lively intonation is a good
        # reference, not a bad one.
        takes.sort(key=lambda t: abs(t[0] - target))
        best_med, best_iqr, wav, sr = takes[0]
        sf.write(OUT / f"{name}.wav", wav, sr)
        pitches[name] = best_med
        opts = ", ".join(f"{t[0]:.0f}±{t[1]:.0f}" for t in takes)
        print(f"[refs] {name:8} kept {best_med:5.1f} Hz (spread {best_iqr:4.1f}) "
              f"target {target:.0f} — takes: {opts}")

    gap = abs(pitches["danny"] - pitches["charlie"])
    print(f"[refs] separation {gap:.1f} Hz")
    # Bounded on BOTH sides. Too close and they are one person; too far and
    # they are a double act, which is the failure this cast was retuned to fix.
    if gap < 18:
        print("[refs] WARNING: under 18 Hz — these will read as the same "
              "person. Re-run, or push the descriptions apart.")
        return 1
    if gap > 60:
        print("[refs] WARNING: over 60 Hz — that reads as caricature rather "
              "than as two colleagues. Re-run.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
