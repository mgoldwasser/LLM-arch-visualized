#!/usr/bin/env python3
"""Generate candidate narrator voices for audition.

Voice descriptions behave like prompts, not dials, so the only way to know
what one sounds like is to hear it. This renders the same podcast-ish line
through a set of candidate descriptions and reports the pitch and pace of
each, so a shortlist can be picked by ear with the numbers alongside.

    tools/tts/.venv/bin/python tools/tts/audition.py --outdir /tmp/aud
"""

import argparse
import pathlib

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"

# Written the way the narration is written, so the audition tests the voice on
# the job it will actually do — conversational, mid-thought, with an aside.
LINE = ("Okay so here's the part that got me. Every token looks at every "
        "other token, all at once — and nobody told it to do that. It just "
        "turned out to be the thing that worked.")

# Deliberately varied along the axes that matter for a podcast read: how
# polished, how energetic, how much the voice moves. Naming the CONTEXT
# ("recording a podcast in a small studio") does more work than naming
# qualities, because it carries pace, distance and register together.
CANDIDATES = {
    "host-warm": (
        "A man in his thirties recording a conversational podcast in a small "
        "studio. Warm, close-mic'd voice, relaxed and completely natural. He "
        "talks the way people actually talk — slightly uneven rhythm, "
        "trailing into some phrases, leaning on others. Not a broadcaster, "
        "not reading. General American accent."),
    "host-dry": (
        "A man in his forties hosting a technology podcast. Dry, easy, "
        "understated delivery with a low-key sense of humour under it. "
        "Conversational and unhurried in rhythm but quick in pace, like "
        "someone who has explained this before and enjoys it. Natural, "
        "unpolished, General American accent."),
    "host-bright": (
        "A man in his late twenties on a podcast, mid-conversation and "
        "genuinely enthusiastic about the subject. Bright and animated "
        "without being loud, with a lot of natural pitch movement — he gets "
        "faster when he is excited and slows down to make a point. Casual "
        "General American accent, sounds like a real person, not a read."),
    "host-gravel": (
        "A man in his forties with a slightly gravelly, lived-in voice, "
        "talking on a podcast. Grounded and confident, speaks in an easy "
        "conversational rhythm with natural hesitations. Rich lower register "
        "but not artificially deep. General American accent, no announcer "
        "polish at all."),
    "host-quick": (
        "A man in his thirties on a fast-moving podcast, thinking out loud "
        "as he talks. Quick, light, agile delivery with plenty of intonation "
        "— he interrupts himself, picks the thread back up, emphasises words "
        "mid-sentence. Completely natural and unrehearsed. General American "
        "accent."),
    "host-storyteller": (
        "A man in his forties telling a story he finds genuinely interesting. "
        "Measured and warm, with real dynamic range — he drops his voice for "
        "the quiet parts and opens up for the payoff. Sounds like a person "
        "talking, never like narration being read. General American accent."),
}


def stats(wav, sr, nwords):
    import torchaudio.functional as F
    p = F.detect_pitch_frequency(
        torch.tensor(wav, dtype=torch.float32), sr,
        freq_low=60, freq_high=350).numpy()
    v = p[(p > 60) & (p < 350)]
    hop = int(sr * 0.01)
    n = len(wav) // hop * hop
    env = np.abs(wav[:n]).reshape(-1, hop).max(1)
    speech = (env > 0.015).sum() * hop / sr
    return (float(np.median(v)),
            float(np.subtract(*np.percentile(v, [75, 25]))),
            nwords / max(speech, 1e-6) * 60)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="audition")
    ap.add_argument("--takes", type=int, default=2)
    args = ap.parse_args()

    out = pathlib.Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Qwen3TTSModel.from_pretrained(
        MODEL, device_map=dev,
        dtype=torch.float32 if dev == "mps" else torch.bfloat16,
        # See design_refs.py: the MPS sdpa kernel aborts on this model's
        # grouped-query attention once the prompt is long enough.
        attn_implementation="eager")

    nw = len(LINE.split())
    print(f"{'candidate':18}{'pitch':>7}{'range':>7}{'wpm':>6}")
    for name, desc in CANDIDATES.items():
        """Two takes each, keep the livelier one.

        VoiceDesign is unstable between calls, so a single roll says as much
        about luck as about the description. Picking on intonation range
        biases toward the takes that actually move, which is the whole point
        of auditioning for a podcast read.
        """
        best = None
        for i in range(args.takes):
            wavs, sr = model.generate_voice_design(
                text=LINE, instruct=desc, language="English")
            med, rng, wpm = stats(wavs[0], sr, nw)
            if best is None or rng > best[1]:
                best = (med, rng, wpm, wavs[0], sr)
        med, rng, wpm, wav, sr = best
        sf.write(out / f"{name}.wav", wav, sr)
        print(f"{name:18}{med:7.0f}{rng:7.0f}{wpm:6.0f}", flush=True)


if __name__ == "__main__":
    main()
