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

SPEAKERS = {
    "danny": (
        "A man in his late twenties from Ohio, now in the California Bay "
        "Area. Bright, buoyant, slightly higher-pitched voice with a quick "
        "step to it. Natural and a little unpolished, not a broadcaster. "
        "Clear General American accent. Speaking evenly and clearly."),
    "charlie": (
        "A man in his forties from rural Ohio, now in the California Bay "
        "Area. Deep, resonant, unhurried voice with real warmth and a bit of "
        "gravel in it. Natural and grounded, not a broadcaster. Clear "
        "General American accent. Speaking evenly and clearly."),
}


def f0(wav, sr):
    """Median voiced pitch — used to check the two are actually different."""
    import torchaudio.functional as F
    p = F.detect_pitch_frequency(
        torch.tensor(wav, dtype=torch.float32), sr,
        freq_low=60, freq_high=350).numpy()
    v = p[(p > 60) & (p < 350)]
    return float(np.median(v)) if len(v) else float("nan")


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
        for i in range(4):
            wavs, sr = model.generate_voice_design(
                text=REF_TEXT, instruct=description, language="English")
            takes.append((f0(wavs[0], sr), wavs[0], sr))
        target = 175.0 if name == "danny" else 105.0
        takes.sort(key=lambda t: abs(t[0] - target))
        best_f0, wav, sr = takes[0]
        sf.write(OUT / f"{name}.wav", wav, sr)
        pitches[name] = best_f0
        spread = [f"{t[0]:.0f}" for t in takes]
        print(f"[refs] {name:8} kept {best_f0:5.1f} Hz "
              f"(target {target:.0f}; takes were {', '.join(spread)}) "
              f"-> {OUT / (name + '.wav')}")

    gap = abs(pitches["danny"] - pitches["charlie"])
    print(f"[refs] separation {gap:.1f} Hz")
    if gap < 25:
        print("[refs] WARNING: under 25 Hz apart — these will read as the "
              "same person. Re-run, or push the descriptions further apart.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
