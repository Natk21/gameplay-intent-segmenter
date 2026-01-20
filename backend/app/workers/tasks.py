import os
import tempfile
import time
from typing import Any, Dict, List, Tuple

from app.workers.celery_app import celery_app
from app.services.job_store import write_job
from app.services.object_store import download_to_path, get_public_url

from app.services.video_utils import extract_frames, get_video_duration
from app.services.motion_utils import compute_motion_signal
from app.services.signal_utils import smooth_signal
from app.services.intent_segmentation import segment_intent_phases
from app.services.intent_insights import compute_intent_insights


# ----------------------------
# Phase helpers (schema + metrics)
# ----------------------------

def _ensure_segment_ids_and_fields(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ensure every segment has:
      - id (stable for UI selection)
      - confidence (float 0-1)
      - dominant_signals (list[str])
      - explanation (string)
    Your existing segment_intent_phases() may already return some of these.
    We only fill missing fields to keep your pipeline real.
    """
    out: List[Dict[str, Any]] = []
    for i, s in enumerate(segments):
        seg = dict(s)

        # Required structural fields
        seg["id"] = seg.get("id", f"seg_{i}")

        # Normalize types
        seg["start"] = float(seg["start"])
        seg["end"] = float(seg["end"])
        seg["phase"] = str(seg["phase"])

        # Optional fields (filled if missing)
        if "confidence" not in seg or seg["confidence"] is None:
            seg["confidence"] = 0.75  # placeholder until Phase 2 scoring
        else:
            seg["confidence"] = float(seg["confidence"])

        if "dominant_signals" not in seg or seg["dominant_signals"] is None:
            seg["dominant_signals"] = []  # will become meaningful in Phase 2
        if "explanation" not in seg or not seg["explanation"]:
            seg["explanation"] = "Segment classified by motion dynamics (smoothed)."

        out.append(seg)

    return out


def _segments_to_transitions(segments: List[Dict[str, Any]],
    signals: Dict[str, List[float]]) -> List[Dict[str, Any]]:
    transitions = []
    t = signals["t"]
    motion = signals.get("motion_smooth") or signals.get("motion_raw")

    for i in range(len(segments) - 1):
        a = segments[i]
        b = segments[i + 1]
        boundary_time = float(a["end"])

        motion_delta = _windowed_signal_delta(
            t, motion, boundary_time
        )

        # Simple confidence heuristic
        confidence = min(a["confidence"], b["confidence"])
        if motion_delta is not None:
            confidence = min(1.0, confidence + abs(motion_delta))

        # Classify change type
        if motion_delta is not None and motion_delta > 0.25:
            change_type = "commitment"
            explanation = (
                "Sustained increase in motion suggests the player commits to an action."
            )
        elif motion_delta is not None and motion_delta < -0.25:
            change_type = "resolution"
            explanation = (
                "Sharp drop in motion suggests resolution or outcome assessment."
            )
        else:
            change_type = "shift"
            explanation = "Gradual change in behavior suggests a strategy shift."

        transitions.append({
            "id": f"tr_{i}",
            "time": boundary_time,
            "from_phase": a["phase"],
            "to_phase": b["phase"],
            "confidence": round(confidence, 2),
            "signal_delta": {
                "motion": motion_delta,
            },
            "change_type": change_type,
            "hesitation": False,  # filled in next step
            "explanation": explanation,
            "from_segment_id": a["id"],
            "to_segment_id": b["id"],
        })

    return transitions


def _compute_metrics(segments: List[Dict[str, Any]], transitions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Simple, stable metrics the UI can show immediately.
    Volatility will be refined later using segment duration + signal variance.
    """
    transitions_count = len(transitions)
    segments_count = len(segments)

    # total duration from segments
    if segments:
        clip_duration = max(float(s["end"]) for s in segments)
    else:
        clip_duration = 0.0

    # transitions per minute
    tpm = (transitions_count / clip_duration) * 60.0 if clip_duration > 0 else 0.0

    # crude label thresholds
    if tpm >= 8:
        label, score = "High", 0.85
    elif tpm >= 3:
        label, score = "Medium", 0.55
    else:
        label, score = "Low", 0.25

    return {
        "segments_count": segments_count,
        "transitions_count": transitions_count,
        "clip_duration_s": clip_duration,
        "transitions_per_min": round(tpm, 3),
        "volatility": {"label": label, "score": score},
    }


def _phase_distribution_from_segments(segments: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Compute % time spent in each phase from the segments.
    """
    totals: Dict[str, float] = {}
    total_time = 0.0

    for s in segments:
        dur = float(s["end"]) - float(s["start"])
        totals[s["phase"]] = totals.get(s["phase"], 0.0) + dur
        total_time += dur

    if total_time <= 0:
        return {}

    return {k: round(v / total_time, 4) for k, v in totals.items()}

def _windowed_signal_delta(
    t: List[float],
    signal: List[float],
    boundary_time: float,
    window_s: float = 0.8
) -> float | None:
    """
    Compute average(signal after boundary) - average(signal before boundary)
    over a small time window.
    """
    before_vals = []
    after_vals = []

    for ti, si in zip(t, signal):
        if boundary_time - window_s <= ti < boundary_time:
            before_vals.append(si)
        elif boundary_time <= ti <= boundary_time + window_s:
            after_vals.append(si)

    if not before_vals or not after_vals:
        return None

    return (sum(after_vals) / len(after_vals)) - (sum(before_vals) / len(before_vals))

def _mark_hesitation(transitions: List[Dict[str, Any]], window_s: float = 2.0):
    """
    Marks transitions as hesitation if multiple transitions occur
    within a short time window.
    """
    for i, tr in enumerate(transitions):
        t0 = tr["time"]
        nearby = [
            t for j, t in enumerate(transitions)
            if i != j and abs(t["time"] - t0) <= window_s
        ]
        if len(nearby) >= 1:
            tr["hesitation"] = True


# ----------------------------
# Celery task
# ----------------------------

@celery_app.task
def run_analysis_job(job_id: str, storage_backend: str, storage_key: str):
    """
    Background job that processes an uploaded video.

    Real pipeline:
      1) Extract frames via ffmpeg
      2) Compute motion signal
      3) Smooth motion
      4) Segment into phases
      5) Compute insights
    Phase 1 upgrades:
      - stable output schema for UI
      - transitions events (intent-change moments)
      - metrics (volatility, transitions count, duration)
      - segment ids + explanation fields
    """

    # 1) Mark processing
    write_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 0.1,
        "message": "Starting analysis",
        "result": None,
    })

    # Resolve local video path
    video_path = storage_key
    temp_dir = None
    if storage_backend == "r2":
        temp_dir = tempfile.TemporaryDirectory()
        video_path = os.path.join(temp_dir.name, os.path.basename(storage_key))
        download_to_path(storage_key, video_path)

    # 2) Extract frames
    frames_dir = os.path.join("data", "frames", job_id)
    frames_extracted, fps_used = extract_frames(
        video_path=video_path,
        output_dir=frames_dir,
        fps=5,
    )
    probed_duration_s = get_video_duration(video_path)
    fallback_duration_s = (
        frames_extracted / fps_used if fps_used > 0 else 0.0
    )
    duration_s = (
        probed_duration_s
        if probed_duration_s is not None
        else fallback_duration_s
    )

    write_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 0.25,
        "message": f"Extracted {frames_extracted} frames at {fps_used} FPS",
        "result": None,
    })

    # 3) Motion signal
    motion_t, motion_signal, interaction_signal, entropy_signal = compute_motion_signal(
        frames_dir,
        fps_used=fps_used
    )

    write_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 0.45,
        "message": "Computed motion signal",
        "result": None,
    })

    # 4) Smooth motion
    smoothed_motion = smooth_signal(motion_signal, window_size=5)

    write_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 0.60,
        "message": "Smoothed motion signal",
        "result": None,
    })

    # 5) Segment phases
    segments = segment_intent_phases(
        motion_t,
        smoothed_motion,
        interaction=interaction_signal,
        entropy=entropy_signal
    )

    # Ensure UI-friendly shape (without changing real segmentation)
    segments = _ensure_segment_ids_and_fields(segments)


    write_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 0.75,
        "message": f"Segmented into {len(segments)} phases",
        "result": None,
    })

    # 6) Insights + metrics
    # Your existing compute_intent_insights likely returns headline + avg segment duration etc.
    insights = compute_intent_insights(segments)

    # Add phase distribution + top-level metrics in stable places
    phase_distribution = _phase_distribution_from_segments(segments)
    transitions = _segments_to_transitions(
        segments,
        signals={
            "t": motion_t,
            "motion_smooth": smoothed_motion,
        }
    )
    _mark_hesitation(transitions)
    metrics = _compute_metrics(segments, transitions)

    # Optional: simulate extra work (keeps UI animation / progress feeling alive)
    for i in range(8, 10):
        time.sleep(0.2)
        write_job(job_id, {
            "job_id": job_id,
            "status": "processing",
            "progress": i / 10.0,
            "message": "Finalizing results...",
            "result": None,
        })
    filename = os.path.basename(video_path)
    if storage_backend == "r2":
        public_url = get_public_url(storage_key)
        if public_url:
            video_url = public_url
        else:
            video_url = ""
    else:
        video_url = f"/videos/{filename}"

    # 7) Final result (stable product schema)
    result = {
        "video": {
            "url": video_url,
            "filename": filename,
            "fps_sampled": fps_used,
            "frames_extracted": frames_extracted,
            "duration_s": round(duration_s, 3),
        },

        # insights stays, but we enhance it with distribution so UI doesn't recompute
        "summary": {
            **(insights or {}),
            "phase_distribution": phase_distribution,
        },

        # stable metrics block for UI panels
        "metrics": metrics,

        # segments + transitions are now first-class
        "segments": segments,
        "transitions": transitions,

        # signals are still included (great for charts/debug)
        "signals": {
            "t": motion_t,
            "motion_raw": motion_signal,
            "motion_smooth": smoothed_motion,
        },
    }

    write_job(job_id, {
        "job_id": job_id,
        "status": "done",
        "progress": 1.0,
        "message": "Analysis complete",
        "result": result,
    })

    if temp_dir is not None:
        temp_dir.cleanup()

    return True
