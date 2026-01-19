import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import (
    _compute_clip_thresholds,
    segment_intent_phases,
)


def test_adaptive_high_scales_with_amplitude():
    motion_a = [0.05, 0.12, 0.18, 0.25] * 10
    motion_b = [0.3, 0.5, 0.7, 0.9] * 10

    high_a = _compute_clip_thresholds(motion_a)["spike"]
    high_b = _compute_clip_thresholds(motion_b)["spike"]

    assert high_b > high_a


def test_flat_clip_no_execute():
    times = [i * 0.2 for i in range(100)]
    motion = [0.08, 0.1, 0.09, 0.11, 0.1] * 20
    segments = segment_intent_phases(times, motion)

    assert all(seg["phase"] != "Execute" for seg in segments)


def test_plateau_produces_pursue_and_outcome():
    times = [i * 0.2 for i in range(110)]
    motion = (
        [0.08] * 30
        + [0.25] * 40
        + [0.85] * 10
        + [0.18] * 30
    )
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    assert any(seg["phase"] == "Pursue" for seg in segments)
    assert sum(1 for seg in segments if seg["phase"] == "Execute") == 1

    execute_index = next(
        i for i, seg in enumerate(segments) if seg["phase"] == "Execute"
    )
    assert any(
        seg["phase"] == "Outcome"
        for seg in segments[execute_index + 1 :]
    )
