from typing import Dict, List, Tuple

import numpy as np


def _compute_clip_thresholds(motion: List[float]) -> Dict[str, float]:
    """
    Returns per-clip thresholds for phase boundaries.
    low: Explore tends to be below this.
    pursue: Pursue tends to be around/above this.
    spike: Execute tends to be above this.
    """
    if len(motion) < 5:
        return {"low": 0.22, "pursue": 0.30, "spike": 0.40}

    motion_arr = np.array(motion, dtype=float)
    if float(np.std(motion_arr)) < 1e-6:
        return {"low": 0.22, "pursue": 0.30, "spike": 0.40}

    p30 = float(np.percentile(motion_arr, 30))
    p55 = float(np.percentile(motion_arr, 55))
    p90 = float(np.percentile(motion_arr, 90))
    p30_span = float(np.percentile(motion_arr, 90)) - p30

    low = max(p30, 0.18)
    pursue = max(p55, low + 0.06)
    spike = max(p90, pursue + 0.08, 0.32)

    if p30_span < 0.08:
        low, pursue, spike = 0.22, 0.30, 0.40

    return {"low": low, "pursue": pursue, "spike": spike}


def _emission_score(
    phase: str,
    m: float,
    prev_phase: str,
    thr: Dict[str, float],
    interaction_t: float,
    entropy_t: float,
    use_multisignal: bool,
) -> float:
    low = thr["low"]
    pursue = thr["pursue"]
    spike = thr["spike"]

    if phase == "Explore":
        score = 0.0
        if m < low:
            score += 2.0
        if low <= m < pursue:
            score += 0.8
        if m >= spike:
            score -= 2.0
        if use_multisignal:
            if entropy_t >= 0.6:
                score += 0.8
            if interaction_t <= 0.25:
                score += 0.5
            if interaction_t >= 0.6 and m >= pursue:
                score -= 0.8
        return score

    if phase == "Pursue":
        score = 0.0
        if pursue <= m < spike:
            score += 2.0
        if low <= m < pursue:
            score += 0.8
        if m < low:
            score -= 1.5
        if m >= spike:
            score -= 1.0
        if use_multisignal:
            if 0.35 <= interaction_t < 0.7:
                score += 0.8
            if interaction_t <= 0.25:
                score -= 0.6
            if entropy_t >= 0.75:
                score -= 0.6
            if prev_phase == "Outcome":
                score -= 1.0
        return score

    if phase == "Execute":
        score = 3.0 if m >= spike else -2.0
        if use_multisignal:
            if interaction_t >= 0.6:
                score += 1.2
            if interaction_t <= 0.3:
                score -= 1.5
            if entropy_t >= 0.8:
                score -= 1.2
            if interaction_t <= 0.3 and entropy_t >= 0.4:
                score -= 2.0
            if interaction_t <= 0.25 and entropy_t >= 0.7:
                score -= 2.0
        return score

    if phase == "Outcome":
        score = 0.0
        if prev_phase == "Execute" and m < low:
            score += 2.5
        if prev_phase == "Outcome" and m < pursue:
            score += 1.2
        if use_multisignal:
            if m < low and interaction_t <= 0.25:
                score += 1.0
            if m < low and entropy_t <= 0.35:
                score += 0.8
            if interaction_t >= 0.5:
                score -= 1.2
            if entropy_t >= 0.6:
                score -= 1.2
        if score == 0.0:
            score = -2.0
        return score

    return -2.0


def _transition_penalty(prev: str, curr: str) -> float:
    if prev == curr:
        return 0.0

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
    return penalties.get((prev, curr), 1.5)


def segment_intent_phases(
    times: List[float],
    motion: List[float],
    interaction: List[float] | None = None,
    entropy: List[float] | None = None,
    low_threshold: float = 0.22,
    spike_threshold: float = 0.4,
    min_segment_s: float = 1.0,
) -> List[Dict]:
    """
    Segment intent phases from smoothed motion signal.

    Phases:
    - Explore: sustained low/moderate motion
    - Execute: sharp motion spike
    - Outcome: motion collapse after execution
    """

    # These constants define a stable, deterministic DP pipeline.
    ROLLING_WINDOW = 7
    MIN_EXPLORE_S = 2.0
    MIN_PURSUE_S = 1.2
    MIN_EXECUTE_S = 0.5
    MIN_OUTCOME_S = 0.8

    if not times or not motion:
        return []

    length = min(len(times), len(motion))
    if length < 4:
        return []

    times = times[:length]
    motion = motion[:length]
    has_multisignal = interaction is not None or entropy is not None
    interaction = interaction or [0.0] * length
    entropy = entropy or [0.0] * length
    interaction = interaction[:length]
    entropy = entropy[:length]

    rolling_mean: List[float] = []
    rolling_interaction: List[float] = []
    rolling_entropy: List[float] = []
    for i in range(length):
        start = max(0, i - ROLLING_WINDOW + 1)
        window = motion[start:i + 1]
        interaction_window = interaction[start:i + 1]
        entropy_window = entropy[start:i + 1]
        rolling_mean.append(sum(window) / len(window))
        rolling_interaction.append(
            sum(interaction_window) / len(interaction_window)
        )
        rolling_entropy.append(
            sum(entropy_window) / len(entropy_window)
        )

    thresholds = _compute_clip_thresholds(rolling_mean)
    phases = ["Explore", "Pursue", "Execute", "Outcome"]

    def append_note(reason: str, note: str) -> str:
        if not reason:
            return note
        return f"{reason} {note}"

    def nearest_index(target_time: float) -> int:
        if target_time <= times[0]:
            return 0
        if target_time >= times[-1]:
            return length - 1
        low = 0
        high = length - 1
        while low <= high:
            mid = (low + high) // 2
            value = times[mid]
            if value == target_time:
                return mid
            if value < target_time:
                low = mid + 1
            else:
                high = mid - 1
        return max(0, min(low, length - 1))

    def min_required_for(phase: str) -> float:
        if phase == "Explore":
            return MIN_EXPLORE_S
        if phase == "Pursue":
            return MIN_PURSUE_S
        if phase == "Execute":
            return MIN_EXECUTE_S
        return MIN_OUTCOME_S

    # Dynamic programming / Viterbi over the smoothed signal.
    dp_scores: List[Dict[str, float]] = []
    back_ptrs: List[Dict[str, str]] = []

    m0 = rolling_mean[0]
    i0 = rolling_interaction[0]
    e0 = rolling_entropy[0]
    dp_scores.append({
        phase: _emission_score(
            phase, m0, phase, thresholds, i0, e0, has_multisignal
        )
        for phase in phases
    })
    back_ptrs.append({phase: phase for phase in phases})

    for i in range(1, length):
        m = rolling_mean[i]
        i_t = rolling_interaction[i]
        e_t = rolling_entropy[i]
        scores: Dict[str, float] = {}
        back: Dict[str, str] = {}
        for curr in phases:
            best_score = float("-inf")
            best_prev = phases[0]
            for prev in phases:
                score = (
                    dp_scores[i - 1][prev]
                    + _emission_score(
                        curr, m, prev, thresholds, i_t, e_t, has_multisignal
                    )
                    - _transition_penalty(prev, curr)
                )
                if score > best_score:
                    best_score = score
                    best_prev = prev
            scores[curr] = best_score
            back[curr] = best_prev
        dp_scores.append(scores)
        back_ptrs.append(back)

    last_phase = max(dp_scores[-1], key=dp_scores[-1].get)
    phase_seq = [last_phase]
    for i in range(length - 1, 0, -1):
        last_phase = back_ptrs[i][last_phase]
        phase_seq.append(last_phase)
    phase_seq.reverse()

    # Convert sequence to segments.
    segments: List[Dict] = []
    start_idx = 0
    for i in range(1, length):
        if phase_seq[i] != phase_seq[start_idx]:
            segments.append({
                "start": round(times[start_idx], 2),
                "end": round(times[i - 1], 2),
                "phase": phase_seq[start_idx],
                "why": "",
            })
            start_idx = i
    segments.append({
        "start": round(times[start_idx], 2),
        "end": round(times[-1], 2),
        "phase": phase_seq[start_idx],
        "why": "",
    })

    # Merge short segments until stable.
    def _merge_short_segments(
        segments_list: List[Dict],
        mins: Dict[str, float],
    ) -> List[Dict]:
        changed = True
        while changed:
            changed = False
            i = 0
            while i < len(segments_list):
                seg = segments_list[i]
                duration = seg["end"] - seg["start"]
                min_required = mins.get(seg["phase"], 0.0)
                if duration + 1e-6 < min_required:
                    note = f"Merged short {seg['phase']} into "
                    if seg["phase"] == "Outcome":
                        if i + 1 < len(segments_list) and segments_list[i + 1]["phase"] != "Execute":
                            target = i + 1
                        elif i > 0 and segments_list[i - 1]["phase"] != "Execute":
                            target = i - 1
                        else:
                            target = i - 1 if i > 0 else i + 1
                    else:
                        target = i - 1 if i > 0 else i + 1
                    if 0 <= target < len(segments_list):
                        segments_list[target]["start"] = min(
                            segments_list[target]["start"], seg["start"]
                        )
                        segments_list[target]["end"] = max(
                            segments_list[target]["end"], seg["end"]
                        )
                        segments_list[target]["why"] = append_note(
                            segments_list[target]["why"],
                            note + segments_list[target]["phase"] + "."
                        )
                        segments_list.pop(i)
                        changed = True
                        i = max(i - 1, 0)
                        continue
                i += 1
        return segments_list

    mins = {
        "Explore": MIN_EXPLORE_S,
        "Pursue": MIN_PURSUE_S,
        "Execute": MIN_EXECUTE_S,
        "Outcome": MIN_OUTCOME_S,
    }
    segments = _merge_short_segments(segments, mins)

    # Remove A -> B -> A flicker patterns (B < 0.8s), repeat until stable.
    flicker_changed = True
    while flicker_changed:
        flicker_changed = False
        i = 1
        while i < len(segments) - 1:
            prev_seg = segments[i - 1]
            seg = segments[i]
            next_seg = segments[i + 1]
            if prev_seg["phase"] == next_seg["phase"] and prev_seg["phase"] != seg["phase"]:
                if (seg["end"] - seg["start"]) < 0.8:
                    prev_seg["end"] = next_seg["end"]
                    prev_seg["why"] = append_note(
                        prev_seg["why"],
                        f"Collapsed short {seg['phase']} flicker."
                    )
                    segments.pop(i + 1)
                    segments.pop(i)
                    flicker_changed = True
                    i = max(i - 1, 1)
                    continue
            i += 1

    # Outcome sanity: if no Execute exists, Outcome becomes Explore.
    has_execute = any(seg["phase"] == "Execute" for seg in segments)
    if not has_execute:
        for seg in segments:
            if seg["phase"] == "Outcome":
                seg["phase"] = "Explore"
                seg["why"] = append_note(
                    seg["why"],
                    "Outcome without Execute converted to Explore."
                )
    else:
        has_outcome = any(seg["phase"] == "Outcome" for seg in segments)
        if not has_outcome:
            execute_index = next(
                (i for i, seg in enumerate(segments) if seg["phase"] == "Execute"),
                None,
            )
            if execute_index is not None:
                for seg in segments[execute_index + 1:]:
                    start_idx = nearest_index(seg["start"])
                    end_idx = nearest_index(seg["end"])
                    if end_idx < start_idx:
                        start_idx, end_idx = end_idx, start_idx
                    window = rolling_mean[start_idx:end_idx + 1]
                    avg = sum(window) / len(window) if window else 0.0
                    if avg < thresholds["low"]:
                        seg["phase"] = "Outcome"
                        seg["why"] = append_note(
                            seg["why"],
                            "Outcome inferred after Execute collapse."
                        )
                        break

    # Demote Execute when motion spikes are diffuse and chaotic.
    if has_multisignal:
        for seg in segments:
            if seg["phase"] != "Execute":
                continue
            start_idx = nearest_index(seg["start"])
            end_idx = nearest_index(seg["end"])
            if end_idx < start_idx:
                start_idx, end_idx = end_idx, start_idx
            interaction_window = rolling_interaction[start_idx:end_idx + 1]
            entropy_window = rolling_entropy[start_idx:end_idx + 1]
            avg_interaction = (
                sum(interaction_window) / len(interaction_window)
                if interaction_window else 0.0
            )
            avg_entropy = (
                sum(entropy_window) / len(entropy_window)
                if entropy_window else 0.0
            )
            if avg_interaction <= 0.3 and avg_entropy >= 0.4:
                seg["phase"] = "Pursue"
                seg["why"] = append_note(
                    seg["why"],
                    "Execute softened due to low interaction/entropy context."
                )

    # Ensure coverage and clamp gaps.
    if segments:
        if segments[0]["start"] > times[0] + 1e-6:
            segments.insert(0, {
                "start": round(times[0], 2),
                "end": segments[0]["start"],
                "phase": "Explore",
                "why": "Inserted to cover clip start.",
            })
        for i in range(1, len(segments)):
            if segments[i]["start"] > segments[i - 1]["end"]:
                segments[i]["start"] = segments[i - 1]["end"]
                segments[i]["why"] = append_note(
                    segments[i]["why"],
                    "Start clamped to close gap."
                )
        if segments[-1]["end"] < times[-1] - 1e-6:
            segments[-1]["end"] = round(times[-1], 2)
            segments[-1]["why"] = append_note(
                segments[-1]["why"],
                "Extended to cover clip end."
            )
        assert segments[0]["start"] <= times[0] + 1e-6
        assert segments[-1]["end"] >= times[-1] - 1e-6

    # Enforce legal ordering by blocking Outcome -> Pursue/Explore/Execute.
    i = 0
    while i < len(segments) - 1:
        current = segments[i]
        next_seg = segments[i + 1]
        if current["phase"] == "Outcome" and next_seg["phase"] != "Outcome":
            next_seg["phase"] = "Outcome"
            next_seg["why"] = append_note(
                next_seg["why"],
                "Illegal Outcome transition blocked; staying Outcome."
            )
        i += 1

    # Build per-segment reasons from stats.
    def build_reason(phase: str, avg: float, peak: float) -> str:
        low = thresholds["low"]
        pursue = thresholds["pursue"]
        spike = thresholds["spike"]
        avg_str = f"{avg:.2f}"
        peak_str = f"{peak:.2f}"
        if phase == "Explore":
            return f"Mostly calm movement (avg motion {avg_str}), below the clip's low baseline."
        if phase == "Pursue":
            return f"Sustained active movement (avg motion {avg_str}) without a spike."
        if phase == "Execute":
            return f"A clear burst of motion (peak {peak_str}) above the clip's spike level."
        return "Movement drops right after a burst, suggesting resolution/cooldown."

    for seg in segments:
        start_idx = nearest_index(seg["start"])
        end_idx = nearest_index(seg["end"])
        if end_idx < start_idx:
            start_idx, end_idx = end_idx, start_idx
        window = rolling_mean[start_idx:end_idx + 1]
        avg = sum(window) / len(window) if window else 0.0
        peak = max(window) if window else 0.0
        base_reason = build_reason(seg["phase"], avg, peak)
        if seg["why"]:
            seg["why"] = append_note(base_reason, seg["why"])
        else:
            seg["why"] = base_reason

    return segments
