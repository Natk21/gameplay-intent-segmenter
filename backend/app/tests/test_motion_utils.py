import os
import sys
import tempfile

import cv2
import numpy as np

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.motion_utils import compute_motion_signal


def _write_test_frame(path: str, value: int) -> None:
    image = np.full((8, 8, 3), value, dtype=np.uint8)
    cv2.imwrite(path, image)


def test_compute_motion_signal_returns_seconds():
    with tempfile.TemporaryDirectory() as tmp_dir:
        _write_test_frame(os.path.join(tmp_dir, "frame_000001.jpg"), 0)
        _write_test_frame(os.path.join(tmp_dir, "frame_000002.jpg"), 255)

        times, motion, interaction, entropy = compute_motion_signal(
            tmp_dir,
            fps_used=5.0
        )

        assert times == [0.2]
        assert len(motion) == 1
        assert len(interaction) == 1
        assert len(entropy) == 1
