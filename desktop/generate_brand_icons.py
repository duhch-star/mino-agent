"""Generate application icons from the approved logo without cropping/redrawing it."""
from pathlib import Path
import shutil
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
source = ROOT / 'assets/logo.png'
target = ROOT / 'pi-web/public/icons'
target.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target / 'minos-logo.png')
with Image.open(source) as image:
    image = image.convert('RGBA')
    for size, name in [(192, 'minos-logo-192.png'), (512, 'minos-logo-512.png'), (180, 'minos-logo-apple.png')]:
        image.resize((size, size), Image.Resampling.LANCZOS).save(target/name)
    image.save(target/'minos-logo.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
shutil.copyfile(target/'minos-logo.ico', ROOT/'pi-web/app/favicon.ico')
print('Generated brand PNG and multi-resolution Windows ICO; interview assets untouched.')
