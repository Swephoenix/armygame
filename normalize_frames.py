from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


SOURCE = Path(__file__).parent / "frames_to_use" / "transparent_frames"
OUTPUT = Path(__file__).parent / "frames_normalized" / "transparent_frames"
CANVAS_SIZE = (1280, 680)
ANCHOR_X = 540
ANCHOR_BOTTOM = 630
ALPHA_THRESHOLD = 16


def subject_anchor(image: Image.Image) -> tuple[float, int]:
    alpha = np.asarray(image.getchannel("A"))
    labels, _ = ndimage.label(alpha > ALPHA_THRESHOLD)
    component_sizes = np.bincount(labels.ravel())

    if len(component_sizes) <= 1:
        raise ValueError("Frame has no visible alpha subject")

    component_sizes[0] = 0
    main_component = labels == component_sizes.argmax()
    y_positions, x_positions = np.nonzero(main_component)
    alpha_weights = alpha[main_component].astype(float)
    center_x = float(np.average(x_positions, weights=alpha_weights))
    return center_x, int(y_positions.max())


def normalize_frame(source_path: Path, output_path: Path) -> None:
    with Image.open(source_path) as source:
        rgba = source.convert("RGBA")
        center_x, bottom = subject_anchor(rgba)
        offset_x = round(ANCHOR_X - center_x)
        offset_y = ANCHOR_BOTTOM - bottom
        normalized = rgba.transform(
            CANVAS_SIZE,
            Image.Transform.AFFINE,
            (1, 0, -offset_x, 0, 1, -offset_y),
            resample=Image.Resampling.NEAREST,
        )
        normalized.save(output_path, format="PNG", optimize=True)


def main() -> None:
    source_frames = sorted(SOURCE.glob("runner_*.png"))
    if not source_frames:
        raise SystemExit(f"No PNG frames found in {SOURCE}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, source_path in enumerate(source_frames, start=1):
        normalize_frame(source_path, OUTPUT / source_path.name)
        if index == 1 or index % 25 == 0 or index == len(source_frames):
            print(f"Normalized {index}/{len(source_frames)}")


if __name__ == "__main__":
    main()
