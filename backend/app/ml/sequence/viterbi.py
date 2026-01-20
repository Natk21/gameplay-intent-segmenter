from typing import Dict, List, Tuple

import numpy as np


def build_transition_penalties(
    phases: List[str],
    scale: float = 1.0,
) -> Dict[Tuple[str, str], float]:
    penalties = {
        ("Explore", "Pursue"): 0.2,
        ("Pursue", "Execute"): 0.3,
        ("Execute", "Outcome"): 0.1,
        ("Outcome", "Explore"): 0.2,
        ("Explore", "Execute"): 1.2,
        ("Pursue", "Outcome"): 0.8,
        ("Outcome", "Pursue"): 1.0,
        ("Explore", "Outcome"): 3.0,
        ("Outcome", "Execute"): 2.5,
        ("Execute", "Explore"): 2.0,
    }

    penalty_map: Dict[Tuple[str, str], float] = {}
    for prev in phases:
        for curr in phases:
            if prev == curr:
                penalty_map[(prev, curr)] = 0.0
            else:
                penalty_map[(prev, curr)] = penalties.get((prev, curr), 1.5) * scale
    return penalty_map


def viterbi_decode(
    log_probs: np.ndarray,
    phases: List[str],
    penalty_scale: float = 1.0,
) -> List[str]:
    if log_probs.size == 0:
        return []

    penalties = build_transition_penalties(phases, scale=penalty_scale)
    num_steps, num_states = log_probs.shape

    dp = np.full((num_steps, num_states), -np.inf, dtype=np.float64)
    back = np.zeros((num_steps, num_states), dtype=np.int32)

    dp[0, :] = log_probs[0, :]

    for t in range(1, num_steps):
        for curr in range(num_states):
            best_score = -np.inf
            best_prev = 0
            curr_phase = phases[curr]
            for prev in range(num_states):
                prev_phase = phases[prev]
                score = dp[t - 1, prev] - penalties[(prev_phase, curr_phase)]
                if score > best_score:
                    best_score = score
                    best_prev = prev
            dp[t, curr] = log_probs[t, curr] + best_score
            back[t, curr] = best_prev

    last_state = int(np.argmax(dp[-1]))
    seq = [last_state]
    for t in range(num_steps - 1, 0, -1):
        last_state = int(back[t, last_state])
        seq.append(last_state)
    seq.reverse()

    return [phases[idx] for idx in seq]


def sequence_to_segments(
    times: List[float],
    phase_seq: List[str],
) -> List[Dict[str, float | str]]:
    if not times or not phase_seq:
        return []

    segments: List[Dict[str, float | str]] = []
    start_idx = 0
    for i in range(1, len(phase_seq)):
        if phase_seq[i] != phase_seq[start_idx]:
            segments.append({
                "start": float(times[start_idx]),
                "end": float(times[i - 1]),
                "phase": phase_seq[start_idx],
            })
            start_idx = i
    segments.append({
        "start": float(times[start_idx]),
        "end": float(times[-1]),
        "phase": phase_seq[start_idx],
    })
    return segments


def merge_short_segments(
    segments: List[Dict[str, float | str]],
    min_durations: Dict[str, float],
) -> List[Dict[str, float | str]]:
    if not segments:
        return []

    changed = True
    segments = list(segments)
    while changed:
        changed = False
        i = 0
        while i < len(segments):
            seg = segments[i]
            duration = float(seg["end"]) - float(seg["start"])
            min_required = min_durations.get(str(seg["phase"]), 0.0)
            if duration + 1e-6 < min_required:
                target = i - 1 if i > 0 else i + 1
                if 0 <= target < len(segments):
                    segments[target]["start"] = min(
                        float(segments[target]["start"]),
                        float(seg["start"]),
                    )
                    segments[target]["end"] = max(
                        float(segments[target]["end"]),
                        float(seg["end"]),
                    )
                    segments.pop(i)
                    changed = True
                    i = max(i - 1, 0)
                    continue
            i += 1

    return segments


def segments_to_frame_labels(
    times: List[float],
    segments: List[Dict[str, float | str]],
) -> List[str]:
    if not times or not segments:
        return []

    labels: List[str] = []
    seg_idx = 0
    for t in times:
        while seg_idx < len(segments) - 1 and t >= float(segments[seg_idx]["end"]):
            seg_idx += 1
        labels.append(str(segments[seg_idx]["phase"]))
    return labels
