from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONCEPT_DIR = ROOT / 'assets' / 'concept'
MENU_IMAGES = {'menu_title.jpg', 'menu_sortie.jpg'}

for src in sorted(CONCEPT_DIR.glob('*.jpg')):
    target_width = 1920 if src.name in MENU_IMAGES else 1600
    with Image.open(src) as image:
        image = image.convert('RGB')
        width, height = image.size
        target_height = round(target_width * height / width)
        image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        for quality in (84, 80, 76, 72):
            image.save(src, 'JPEG', quality=quality, optimize=True, progressive=True, subsampling=2)
            if src.stat().st_size <= 900 * 1024:
                break
    with Image.open(src) as check:
        assert check.format == 'JPEG', (src, check.format)
        assert check.size == (target_width, target_height), (src, check.size)
    print(f'CONCEPT_IMAGE_OK name={src.name} dimensions={target_width}x{target_height} bytes={src.stat().st_size} quality={quality}')
