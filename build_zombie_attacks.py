from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).parent
SOURCE = ROOT / "zombie_attack_sources" / "transparent"
REFERENCE = ROOT / "zombie_segments" / "walk_loop" / "transparent_frames" / "zombie_000001.png"
CANVAS_SIZE = (720, 1280)
SEQUENCES = {
    "attack_1": [
        "attack1_anticipation.png",
        "attack1_mid.png",
        "attack1_contact.png",
        "attack1_contact.png",
        "attack1_mid.png",
        "attack1_anticipation.png",
    ],
    "attack_2": [
        "attack2_anticipation.png",
        "attack2_mid.png",
        "attack2_contact.png",
        "attack2_contact.png",
        "attack2_mid.png",
        "attack2_anticipation.png",
    ],
}


def subject_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("source contains no visible subject")
    return bbox


def body_anchor_x(image: Image.Image, bbox: tuple[int, int, int, int]) -> float:
    alpha = image.getchannel("A")
    left, top, right, bottom = bbox
    height = bottom - top
    band_top = top + round(height * 0.48)
    band_bottom = top + round(height * 0.72)
    points = []
    pixels = alpha.load()
    for y in range(band_top, band_bottom):
        for x in range(left, right):
            if pixels[x, y] > 32:
                points.append(x)
    if not points:
        return (left + right) / 2
    points.sort()
    return float(points[len(points) // 2])


def normalize_pose(
    source: Image.Image,
    target_height: int,
    target_ground: int,
    target_anchor_x: float,
) -> Image.Image:
    source = source.convert("RGBA")
    bbox = subject_bbox(source)
    anchor_x = body_anchor_x(source, bbox)
    crop = source.crop(bbox)
    max_width = CANVAS_SIZE[0] - 56
    scale = min(target_height / crop.height, max_width / crop.width)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    resized = crop.resize(size, Image.Resampling.LANCZOS)
    local_anchor_x = (anchor_x - bbox[0]) * scale
    paste_x = round(target_anchor_x - local_anchor_x)
    paste_y = target_ground - resized.height
    if paste_x < 0 or paste_x + resized.width > CANVAS_SIZE[0] or paste_y < 0:
        raise ValueError(f"normalized pose would clip: {(paste_x, paste_y, *size)}")
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(resized, (paste_x, paste_y))
    return canvas


def checkerboard(size: tuple[int, int], tile: int = 16) -> Image.Image:
    image = Image.new("RGB", size, (238, 238, 238))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(210, 210, 210))
    return image


def write_contact_sheet(frames: list[Image.Image], output: Path) -> None:
    cell_size = (240, 426)
    sheet = Image.new("RGB", (cell_size[0] * 3, cell_size[1] * 2), "white")
    for index, frame in enumerate(frames):
        preview = frame.resize(cell_size, Image.Resampling.LANCZOS)
        backdrop = checkerboard(cell_size)
        backdrop.paste(preview, (0, 0), preview)
        sheet.paste(backdrop, ((index % 3) * cell_size[0], (index // 3) * cell_size[1]))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def main() -> None:
    reference = Image.open(REFERENCE).convert("RGBA")
    reference_bbox = subject_bbox(reference)
    target_height = reference_bbox[3] - reference_bbox[1]
    target_ground = reference_bbox[3]
    target_anchor_x = body_anchor_x(reference, reference_bbox)

    contract = {
        "fps": 12,
        "playback": "once_then_walk",
        "contact_frame": 4,
        "frame_count": 6,
        "variants": {},
    }
    for segment, source_names in SEQUENCES.items():
        output_directory = ROOT / "zombie_segments" / segment / "transparent_frames"
        output_directory.mkdir(parents=True, exist_ok=True)
        frames = []
        for frame_number, source_name in enumerate(source_names, start=1):
            with Image.open(SOURCE / source_name) as source:
                normalized = normalize_pose(source, target_height, target_ground, target_anchor_x)
            normalized.save(output_directory / f"zombie_{frame_number:06d}.png")
            frames.append(normalized)
        write_contact_sheet(frames, ROOT / "zombie_segments" / segment / "contact_sheet.png")
        contract["variants"][segment] = {
            "frames": source_names,
            "entry": "walk",
            "exit": "walk",
        }

    contract_path = ROOT / "zombie_segments" / "attack_contract.json"
    contract_path.write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(SEQUENCES)} zombie attacks on {CANVAS_SIZE[0]}x{CANVAS_SIZE[1]}")


if __name__ == "__main__":
    main()
