import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import segment_intent_phases


def test_segments_have_valid_bounds_and_coverage():
    times = [i * 0.2 for i in range(100)]
    motion = [0.12] * 30 + [0.28] * 30 + [0.7] * 10 + [0.15] * 30
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    assert segments
    assert segments[0]["start"] <= times[0] + 1e-6
    assert segments[-1]["end"] >= times[-1] - 1e-6
    for seg in segments:
        assert seg["end"] >= seg["start"]


def test_no_micro_flicker_patterns():
    times = [i * 0.2 for i in range(120)]
    motion = [0.2 + (0.05 if i % 6 == 0 else 0) for i in range(120)]
    segments = segment_intent_phases(times, motion)

    for a, b, c in zip(segments, segments[1:], segments[2:]):
        if a["phase"] == c["phase"] and a["phase"] != b["phase"]:
            assert (b["end"] - b["start"]) >= 0.5 - 1e-6


def test_outcome_requires_execute():
    times = [i * 0.2 for i in range(120)]
    motion = [0.1] * 50 + [0.25] * 20 + [0.18] * 50
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    if not any(seg["phase"] == "Execute" for seg in segments):
        assert all(seg["phase"] != "Outcome" for seg in segments)


def test_pursue_on_mid_level_sustained_motion():
    times = [i * 0.2 for i in range(120)]
    motion = [0.1] * 20 + [0.28] * 60 + [0.12] * 40
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    assert any(seg["phase"] == "Pursue" for seg in segments)


def test_execute_on_spike_region():
    times = [i * 0.2 for i in range(120)]
    motion = [0.1] * 40 + [0.85] * 10 + [0.12] * 70
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    assert any(seg["phase"] == "Execute" for seg in segments)
