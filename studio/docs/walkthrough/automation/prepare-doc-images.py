"""Prepare screenshots for the Word guide: shrink them and split tall full-page captures.

Images are scaled to at most 1100 px wide and saved as JPEG to
../screenshots/doc-images/. manifest.json lists each file's pixel size and the width
of the original screenshot (so the guide never enlarges a small capture). A capture
taller than a page (1.25 times its width) is cut into equal slices named
<name>--part<k>of<n>.jpg. The original PNG screenshots are untouched.
"""
import json
import math
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "screenshots"
OUT = SRC / "doc-images"
MAX_W = 1100
QUALITY = 82
MAX_RATIO = 1.25

shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir()
sizes = {}
for path in sorted(SRC.glob("*.png")):
    with Image.open(path) as source:
        img = source.convert("RGB")
    w, h = img.size
    n = 1 if h / w <= MAX_RATIO * 1.1 else math.ceil(h / (w * MAX_RATIO))
    slice_h = math.ceil(h / n)
    for i in range(n):
        part = img.crop((0, i * slice_h, w, min(h, (i + 1) * slice_h)))
        if w > MAX_W:
            part = part.resize((MAX_W, round(part.height * MAX_W / w)), Image.LANCZOS)
        name = f"{path.stem}.jpg" if n == 1 else f"{path.stem}--part{i + 1}of{n}.jpg"
        part.save(OUT / name, quality=QUALITY, optimize=True, progressive=True)
        sizes[name] = [part.width, part.height, w]
(OUT / "manifest.json").write_text(json.dumps(sizes, indent=1))
print(f"Prepared {len(sizes)} images in {OUT}")
