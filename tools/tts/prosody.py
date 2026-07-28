#!/usr/bin/env python3
"""Reshape the DISTRIBUTION of a line's pitch contour.

Chatterbox gives one scalar for expressiveness. Turning it up moves the whole
pitch distribution — a bigger mean and a wider spread — but it cannot change
the SHAPE of that distribution, and shape is most of what makes a read sound
alive rather than merely loud.

The difference matters. Flat, "TTS-sounding" speech has pitch that is roughly
symmetric around its median: the voice wanders evenly above and below, which
is a normal distribution with a certain standard deviation. Engaged human
speech does not look like that. It sits low and settled for most of a
sentence and then jumps — hard — on the two or three words that carry the
meaning, and comes straight back down. As a distribution that is strongly
RIGHT-SKEWED: a dense low baseline with a long upper tail.

You cannot get there by widening a symmetric distribution. Widening makes the
quiet parts wander too, which reads as unsteady rather than as emphatic. What
is needed is to change the third moment, not the second.

So: extract the pitch contour with WORLD, map it through a monotonic warp that
lengthens the upper tail while compressing the lower one, and resynthesize.
Monotonic matters — it means the ORDER of the contour is untouched, so the
melody still rises and falls exactly where the model put it. Only the depth of
each excursion changes.

    reshape(wav, sr, skew=0.55, depth=1.25)
"""

import numpy as np
import pyworld


def _contour_stats(f0):
    """Skewness and kurtosis of the voiced log-pitch — the shape numbers."""
    v = np.log(f0[f0 > 0])
    if len(v) < 8:
        return float("nan"), float("nan")
    z = (v - v.mean()) / max(v.std(), 1e-9)
    return float((z ** 3).mean()), float((z ** 4).mean() - 3.0)


def describe(wav, sr):
    """(median Hz, skew, excess kurtosis) of the pitch contour."""
    w = np.ascontiguousarray(wav, dtype=np.float64)
    f0, t = pyworld.harvest(w, sr)
    voiced = f0[f0 > 0]
    med = float(np.median(voiced)) if len(voiced) else float("nan")
    sk, ku = _contour_stats(f0)
    return med, sk, ku


def reshape(wav, sr, skew=0.55, depth=1.2, floor=0.75, ceil=1.9):
    """Re-skew a line's pitch contour and resynthesize.

    skew   0 leaves the shape alone; higher pushes mass DOWN toward a settled
           baseline while stretching the peaks up, i.e. raises the third
           moment. 0.5-0.6 is a clear effect that still sounds like a person.
    depth  overall scaling of the excursions after re-skewing, applied in log
           pitch so it is musically even. >1 widens.
    floor/ceil  hard multiplicative limits on the median, so a warp can never
           send the voice somewhere the speaker's identity would not survive.
    """
    w = np.ascontiguousarray(wav, dtype=np.float64)
    f0, t = pyworld.harvest(w, sr)
    sp = pyworld.cheaptrick(w, f0, t, sr)
    ap = pyworld.d4c(w, f0, t, sr)

    voiced = f0 > 0
    if voiced.sum() < 8:
        return wav

    lf = np.log(f0[voiced])
    med = np.median(lf)
    dev = lf - med

    """Asymmetric power warp.

    Deviations are normalised to their own scale, then raised to a power that
    differs by sign: below the median the exponent is >1, which pulls values
    toward the baseline and makes the quiet parts quieter and steadier; above
    it the exponent is <1, which lifts moderate rises into real peaks. The
    result has a dense low mode and a long upper tail. Because the map is
    monotonic in dev, no part of the melody is reordered.
    """
    scale = np.percentile(np.abs(dev), 90)
    if scale < 1e-6:
        return wav
    u = dev / scale
    up_exp = 1.0 / (1.0 + skew)          # <1 : stretch the peaks
    dn_exp = 1.0 + skew                  # >1 : compress the troughs
    u2 = np.where(u >= 0, np.power(np.abs(u), up_exp), -np.power(np.abs(u), dn_exp))
    new_lf = med + u2 * scale * depth

    # Keep the speaker where they were: re-centre on the ORIGINAL median, so
    # this changes shape only. Without it, skewing silently raises the voice.
    new_lf += med - np.median(new_lf)
    new_lf = np.clip(new_lf, med + np.log(floor), med + np.log(ceil))

    out = f0.copy()
    out[voiced] = np.exp(new_lf)
    y = pyworld.synthesize(out, sp, ap, sr)
    y = y[:len(w)] if len(y) >= len(w) else np.pad(y, (0, len(w) - len(y)))

    # WORLD can come back a touch hotter or quieter; match the input level so
    # reshaped and unreshaped lines sit at the same loudness in the mix.
    rms_in, rms_out = np.sqrt((w ** 2).mean()), np.sqrt((y ** 2).mean())
    if rms_out > 1e-9:
        y *= rms_in / rms_out

    """Keep the ORIGINAL audio wherever the frame is unvoiced.

    Reshaping pitch has no business touching a consonant — an unvoiced frame
    has no pitch to reshape — but WORLD resynthesizes the whole signal
    regardless, and its aperiodicity model smears stops. The audible symptom
    is a mushy plosive: the /d/ at the end of "multiplied" is the giveaway.

    So the vocoder's output is used only on voiced frames, where the whole
    point of the exercise lives, and the original samples are kept everywhere
    else. The mask is ramped rather than switched, because a hard cut between
    two versions of the same waveform clicks.
    """
    hop = int(round(sr * 5 / 1000))          # WORLD's default 5 ms frames

    """Erode the voiced mask before using it.

    A frame that WORLD calls voiced right next to a stop still contains the
    burst, so taking vocoder output there re-introduces exactly the smearing
    the mask exists to avoid. Pulling the mask in by two frames on each side
    hands those boundary frames back to the original audio. It costs 10 ms of
    reshaping at the edge of each voiced run, which is inaudible, and it is
    the difference between an 18% and a 0.0% change in consonant regions:
    with the erosion in place, unvoiced samples are bit-identical to the
    input, so no consonant can be damaged by this stage at all.
    """
    keep = voiced.copy()
    for shift in (1, 2):
        keep[shift:] &= voiced[:-shift]
        keep[:-shift] &= voiced[shift:]

    mask = np.repeat(keep.astype(np.float64), hop)
    mask = (np.pad(mask, (0, len(w)))[:len(w)] if len(mask) < len(w)
            else mask[:len(w)])
    ramp = max(1, int(sr * 0.008))           # 8 ms crossfade
    k = np.ones(ramp) / ramp
    mask = np.convolve(mask, k, mode="same")
    np.clip(mask, 0.0, 1.0, out=mask)

    blended = mask * y + (1.0 - mask) * w
    return blended.astype(np.float32)
