"""Render the first vocabulary-table page for each course for PDF auditing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=("A1", "A2"), required=True)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=Path("data/vocabulary.json"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scale", type=float, default=2.5)
    parser.add_argument("--contact", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data = json.loads(args.data.read_text(encoding="utf-8"))
    courses = [course for course in data["courses"] if course["level"] == args.level]
    args.output.mkdir(parents=True, exist_ok=True)

    document = pdfium.PdfDocument(str(args.pdf))
    rendered: list[tuple[dict, Path]] = []
    for course in courses:
        page_number = int(course["sourceStartPage"])
        page = document[page_number - 1]
        bitmap = page.render(scale=args.scale)
        image = bitmap.to_pil()
        output_path = args.output / f"{course['id']}-{page_number:03d}.png"
        image.save(output_path, optimize=True)
        rendered.append((course, output_path))
        print(output_path)

    if args.contact:
        for sheet_index in range(0, len(rendered), 9):
            sheet_items = rendered[sheet_index : sheet_index + 9]
            canvas = Image.new("RGB", (1500, 1500), "white")
            draw = ImageDraw.Draw(canvas)
            for item_index, (course, output_path) in enumerate(sheet_items):
                image = Image.open(output_path).convert("RGB")
                image.thumbnail((480, 440))
                x = (item_index % 3) * 500
                y = (item_index // 3) * 500
                draw.text((x + 5, y + 5), f"{course['id']} page {course['sourceStartPage']} current {course['wordCount']}", fill="black")
                canvas.paste(image, (x + 5, y + 35))
            contact_path = args.output / f"{args.level.lower()}-contact-{sheet_index // 9 + 1}.png"
            canvas.save(contact_path, optimize=True)
            print(contact_path)


if __name__ == "__main__":
    main()
