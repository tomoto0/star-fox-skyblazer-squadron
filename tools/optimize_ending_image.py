from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "concept" / "ending_debrief.jpg"
TARGET = (1920, 1080)
MAX_BYTES = 900 * 1024

with Image.open(SOURCE) as image:
    image = image.convert("RGB").resize(TARGET, Image.Resampling.LANCZOS)
    for quality in (88, 84, 80, 76, 72):
        image.save(SOURCE, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=2)
        if SOURCE.stat().st_size <= MAX_BYTES:
            break

with Image.open(SOURCE) as verify:
    assert verify.format == "JPEG", verify.format
    assert verify.size == TARGET, verify.size

print(
    f"ENDING_IMAGE_OK dimensions={TARGET[0]}x{TARGET[1]} "
    f"bytes={SOURCE.stat().st_size} quality={quality}"
)
