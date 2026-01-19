from typing import List


def smooth_signal(
    signal: List[float],
    window_size: int = 5,
) -> List[float]:
    """
    Apply a simple moving average to a 1D signal.

    Args:
        signal: raw signal values
        window_size: number of points to average over

    Returns:
        smoothed signal (same length as input)
    """
    if not signal or window_size <= 1:
        return signal

    smoothed = []
    half = window_size // 2

    for i in range(len(signal)):
        start = max(0, i - half)
        end = min(len(signal), i + half + 1)
        window = signal[start:end]
        smoothed.append(sum(window) / len(window))

    return smoothed
