# Intent Segmentation Dataset v1

## Structure
- `labels/` per-clip JSON labels
- `notes/` per-clip annotation notes
- `media/` optional video files (e.g., mp4)
- `dataset.json` dataset index

## Media placement
Place clip video files in `media/` and update `dataset.json` with `media_path`
when filenames are known.
