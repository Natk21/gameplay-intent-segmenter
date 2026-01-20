from typing import List, Tuple

import numpy as np

try:
    import librosa
except ImportError as exc:  # pragma: no cover - dependency handled at runtime
    raise ImportError(
        "librosa is required for audio feature extraction. "
        "Install it via requirements.txt."
    ) from exc


def compute_audio_features(
    audio_path: str,
    fps: float,
) -> Tuple[List[float], List[float], List[float]]:
    """
    Compute audio energy (RMS) and spectral flux aligned to a target fps.

    Returns:
        times: timestamps in seconds
        energy: normalized RMS energy per frame
        flux: normalized spectral flux per frame
    """
    if fps <= 0:
        return [], [], []

    y, sr = librosa.load(audio_path, sr=None, mono=True)
    if y.size == 0:
        return [], [], []

    hop_length = max(1, int(sr / fps))
    frame_length = max(2048, hop_length * 2)

    rms = librosa.feature.rms(
        y=y,
        frame_length=frame_length,
        hop_length=hop_length,
    )[0]

    stft = librosa.stft(
        y,
        n_fft=2048,
        hop_length=hop_length,
        center=True,
    )
    magnitude = np.abs(stft)
    flux = np.sum(np.maximum(0.0, np.diff(magnitude, axis=1)), axis=0)
    flux = np.concatenate(([0.0], flux))

    times = (np.arange(len(rms)) / float(fps)).tolist()

    energy = rms.astype(float)
    flux = flux.astype(float)

    if energy.size > 0:
        max_energy = float(np.max(energy))
        if max_energy > 0:
            energy = energy / max_energy

    if flux.size > 0:
        max_flux = float(np.max(flux))
        if max_flux > 0:
            flux = flux / max_flux

    return times, energy.tolist(), flux.tolist()
