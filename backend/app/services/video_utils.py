import os
import subprocess
from typing import Optional, Tuple

def extract_frames(
    video_path: str,
    output_dir: str,
    fps: int = 5,
) -> Tuple[int, int]:
    """
    Extract frames from a video using ffmpeg.

    Returns:
        (frames_extracted, fps_used)
    """
    os.makedirs(output_dir, exist_ok=True)

    # ffmpeg command:
    # -i input video
    # -vf fps=FPS → sample frames
    # frame_%06d.jpg → zero-padded filenames
    cmd = [
        "ffmpeg",
        "-y",                  # overwrite existing files
        "-i", video_path,
        "-vf", f"fps={fps}",
        os.path.join(output_dir, "frame_%06d.jpg"),
    ]

    subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )

    # Count extracted frames
    frames = [
        f for f in os.listdir(output_dir)
        if f.endswith(".jpg")
    ]

    return len(frames), fps


def get_video_duration(video_path: str) -> Optional[float]:
    """
    Probe video duration in seconds using ffprobe.
    Returns None if probing fails or duration is non-finite.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return None

    raw = result.stdout.strip()
    try:
        value = float(raw)
    except ValueError:
        return None

    if value <= 0:
        return None
    return value
