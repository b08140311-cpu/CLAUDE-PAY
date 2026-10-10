"""用 assets/icon.png 覆蓋 Capacitor 預設的 launcher 圖示(一般 + 圓形 + adaptive)。"""
from PIL import Image
import pathlib
src = Image.open('assets/icon.png').convert('RGB')
res = pathlib.Path('android/app/src/main/res')
def put(img, size, scale, path):
    c = Image.new('RGB', (size, size), (0, 0, 0))
    n = round(size * scale)
    c.paste(img.resize((n, n), Image.LANCZOS), ((size - n) // 2, (size - n) // 2))
    path.parent.mkdir(parents=True, exist_ok=True)
    c.save(path)
for d, legacy, fg in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    for n in ('ic_launcher', 'ic_launcher_round'):
        put(src, legacy, 1.0, res / f'mipmap-{d}' / f'{n}.png')
    put(src, fg, 0.68, res / f'mipmap-{d}' / 'ic_launcher_foreground.png')
bg = res / 'values' / 'ic_launcher_background.xml'
bg.parent.mkdir(parents=True, exist_ok=True)
bg.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n')
print('icons written')
