import os
import cv2
import numpy as np
from typing import List, Tuple


def compute_motion_signal(
    frames_dir: str,
    fps_used: float
) -> Tuple[List[float], List[float], List[float], List[float]]:
    """
    Compute a simple motion signal from extracted frames.

    Returns:
        times: seconds from start of video (sampled by fps_used)
        motion: normalized motion magnitude per frame
        interaction: normalized motion concentration per frame
        entropy: normalized luminance entropy per frame
    """

    frame_files = sorted(
        f for f in os.listdir(frames_dir)
        if f.endswith(".jpg")
    )

    if len(frame_files) < 2:
        return [], [], [], []

    motion_values: List[float] = []
    interaction_values: List[float] = []
    entropy_values: List[float] = []
    times: List[float] = []

    prev_gray = None

    for idx, frame_name in enumerate(frame_files):
        frame_path = os.path.join(frames_dir, frame_name)

        frame = cv2.imread(frame_path)
        if frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion = float(np.mean(diff))
            motion_values.append(motion)
            times.append(idx / fps_used if fps_used > 0 else 0.0)

            # Interaction: motion concentration across a 4x4 grid
            h, w = diff.shape
            cell_h = max(h // 4, 1)
            cell_w = max(w // 4, 1)
            cell_motions = []
            for row in range(4):
                for col in range(4):
                    y0 = row * cell_h
                    x0 = col * cell_w
                    y1 = h if row == 3 else (row + 1) * cell_h
                    x1 = w if col == 3 else (col + 1) * cell_w
                    cell = diff[y0:y1, x0:x1]
                    if cell.size == 0:
                        continue
                    cell_motions.append(float(np.mean(cell)))
            if cell_motions:
                cell_mean = float(np.mean(cell_motions))
                cell_std = float(np.std(cell_motions))
                interaction_values.append(
                    cell_std / (cell_mean + 1e-6)
                )
            else:
                interaction_values.append(0.0)

            # Entropy: 32-bin normalized luminance entropy
            hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
            hist = hist.flatten()
            total = float(np.sum(hist))
            if total > 0:
                probs = hist / total
                entropy = -float(
                    np.sum(
                        probs * np.log2(probs + 1e-12)
                    )
                )
                entropy_values.append(entropy / np.log2(32))
            else:
                entropy_values.append(0.0)

        prev_gray = gray

    # Normalize signals to [0, 1]
    if motion_values:
        max_val = max(motion_values)
        if max_val > 0:
            motion_values = [m / max_val for m in motion_values]

    if interaction_values:
        max_val = max(interaction_values)
        if max_val > 0:
            interaction_values = [v / max_val for v in interaction_values]

    if entropy_values:
        max_val = max(entropy_values)
        if max_val > 0:
            entropy_values = [v / max_val for v in entropy_values]

    return times, motion_values, interaction_values, entropy_values
