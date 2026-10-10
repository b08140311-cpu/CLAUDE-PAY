"""把 src/apps.js 裡的 androidPackage 寫進 AndroidManifest.xml 的 <queries>,
Android 11+ 沒宣告就看不到其他 App,canOpenUrl 會一律回傳 false。"""
import re, pathlib, sys

apps = pathlib.Path('src/apps.js').read_text(encoding='utf-8')
pkgs = [p for p in re.findall(r"androidPackage:\s*'([^']+)'", apps) if p]
mf = pathlib.Path('android/app/src/main/AndroidManifest.xml')
xml = mf.read_text(encoding='utf-8')
block = '    <queries>\n' + ''.join(f'        <package android:name="{p}" />\n' for p in pkgs) + '    </queries>\n'
if '<queries>' in xml:
    sys.exit('queries already present')
xml = xml.replace('    <application', block + '    <application', 1)
mf.write_text(xml, encoding='utf-8')
print('queries:', pkgs)
