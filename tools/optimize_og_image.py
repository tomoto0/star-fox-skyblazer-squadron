from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / 'assets/og/skyblazer_og_source.png'
out = ROOT / 'assets/og/skyblazer_og.jpg'
target = (1200, 630)
limit = 600 * 1024

with Image.open(src) as im:
    im = im.convert('RGB')
    sw, sh = im.size
    target_ratio = target[0] / target[1]
    source_ratio = sw / sh
    if source_ratio > target_ratio:
        crop_w = round(sh * target_ratio)
        # Preserve the player fighter and the carrier silhouette in the social frame.
        left = min(max(0, round(sw * 0.02)), sw - crop_w)
        box = (left, 0, left + crop_w, sh)
    else:
        crop_h = round(sw / target_ratio)
        top = max(0, (sh - crop_h) // 2)
        box = (0, top, sw, top + crop_h)
    image = im.crop(box).resize(target, Image.Resampling.LANCZOS)
    for quality in (88, 84, 80, 76, 72, 68):
        image.save(out, 'JPEG', quality=quality, optimize=True, progressive=True, subsampling=2)
        if out.stat().st_size < limit:
            break

with Image.open(out) as check:
    assert check.size == target, check.size
    assert check.format == 'JPEG', check.format
assert out.stat().st_size < limit, out.stat().st_size
print(f'OG_IMAGE_OK path={out} dimensions={check.size[0]}x{check.size[1]} bytes={out.stat().st_size} quality={quality}')
