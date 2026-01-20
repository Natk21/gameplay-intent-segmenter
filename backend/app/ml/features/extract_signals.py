import argparse
import json
import tempfile
from pathlib import Path
from typing import Dict, List

import numpy as np

from app.services.motion_utils import compute_motion_signal
from app.services.video_utils import extract_frames, get_video_duration
from app.ml.features.audio_features import compute_audio_features


def _load_json(path: Path) -> Dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _interp_to_times(
    target_times: List[float],
    source_times: List[float],
    source_values: List[float],
) -> List[float]:
    if not source_times or not source_values:
        return [0.0 for _ in target_times]

    return np.interp(
        np.array(target_times, dtype=float),
        np.array(source_times, dtype=float),
        np.array(source_values, dtype=float),
        left=0.0,
        right=0.0,
    ).astype(float).tolist()


def extract_signals_for_clip(
    video_path: Path,
    fps: int,
) -> Dict[str, List[float]]:
    with tempfile.TemporaryDirectory() as temp_dir:
        frames_dir = Path(temp_dir) / "frames"
        extract_frames(
            video_path=str(video_path),
            output_dir=str(frames_dir),
            fps=fps,
        )
        motion_t, motion, interaction, entropy = compute_motion_signal(
            str(frames_dir),
            fps_used=float(fps),
        )

    # Audio features aligned to motion times.
    try:
        audio_t, audio_energy, audio_flux = compute_audio_features(
            str(video_path),
            fps=float(fps),
        )
    except Exception:
        audio_t, audio_energy, audio_flux = [], [], []

    audio_energy = _interp_to_times(motion_t, audio_t, audio_energy)
    audio_flux = _interp_to_times(motion_t, audio_t, audio_flux)

    return {
        "t": motion_t,
        "motion": motion,
        "interaction": interaction,
        "entropy": entropy,
        "audio_energy": audio_energy,
        "audio_flux": audio_flux,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract motion + audio signals for labeled clips."
    )
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to dataset.json",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=15,
        help="FPS to sample frames/audio features.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Override output directory for signals.",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    dataset = _load_json(dataset_path)

    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else dataset_path.parent / "signals"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    items = dataset.get("items", [])
    for item in items:
        clip_id = item["clip_id"]
        media_path = dataset_path.parent / item["media_path"]
        if not media_path.exists():
            raise FileNotFoundError(f"Missing media file: {media_path}")

        signals = extract_signals_for_clip(
            video_path=media_path,
            fps=args.fps,
        )
        duration_s = get_video_duration(str(media_path)) or 0.0

        output_path = output_dir / f"{clip_id}.npz"
        np.savez_compressed(
            output_path,
            t=np.array(signals["t"], dtype=np.float32),
            motion=np.array(signals["motion"], dtype=np.float32),
            interaction=np.array(signals["interaction"], dtype=np.float32),
            entropy=np.array(signals["entropy"], dtype=np.float32),
            audio_energy=np.array(signals["audio_energy"], dtype=np.float32),
            audio_flux=np.array(signals["audio_flux"], dtype=np.float32),
            fps_used=float(args.fps),
            duration_s=float(duration_s),
        )

        print(f"[signals] {clip_id} -> {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
