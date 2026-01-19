import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import segment_intent_phases


def phase_order_index(phase: str) -> int:
    order = ["Explore", "Pursue", "Execute", "Outcome"]
    return order.index(phase)


def test_no_flicker_under_oscillation():
    times = [i * 0.2 for i in range(80)]
    motion = [0.28 if i % 2 == 0 else 0.32 for i in range(80)]
    segments = segment_intent_phases(times, motion)

    for seg in segments:
        assert (seg["end"] - seg["start"]) >= 0.6 - 1e-6

    for prev, curr in zip(segments, segments[1:]):
        assert prev["phase"] != curr["phase"] or (
            (curr["end"] - curr["start"]) >= 0.6 - 1e-6
        )


def test_legal_ordering_only():
    times = [i * 0.25 for i in range(120)]
    motion = (
        [0.12] * 12
        + [0.3] * 12
        + [0.5] * 12
        + [0.2] * 84
    )
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    for prev, curr in zip(segments, segments[1:]):
        assert phase_order_index(prev["phase"]) <= phase_order_index(
            curr["phase"]
        ) or (
            prev["phase"] == "Pursue" and curr["phase"] == "Explore"
        )


def test_coverage_of_time_range():
    times = [i * 0.5 for i in range(40)]
    motion = [0.15] * 40
    segments = segment_intent_phases(times, motion)

    assert segments[0]["start"] == times[0]
    assert segments[-1]["end"] == times[-1]


def test_outcome_after_execute_collapse():
    times = [i * 0.2 for i in range(80)]
    motion = (
        [0.12] * 10
        + [0.32] * 10
        + [0.55] * 10
        + [0.18] * 50
    )
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    outcomes = [
        seg for seg in segments if seg["phase"] == "Outcome"
    ]
    assert outcomes
    assert all(
        (seg["end"] - seg["start"]) >= 0.8 - 1e-6
        for seg in outcomes
    )


def test_short_pursue_is_merged():
    times = [i * 0.2 for i in range(60)]
    motion = (
        [0.18] * 20
        + [0.31] * 2
        + [0.18] * 38
    )
    motion = motion[: len(times)]
    segments = segment_intent_phases(times, motion)

    assert all(seg["phase"] != "Pursue" for seg in segments)
