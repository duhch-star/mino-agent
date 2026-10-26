from PIL import Image
import numpy as np
from scipy import ndimage

def eye_comps(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]
    dark = lum < 100
    lab, n = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, n+1))
    comps = []
    for cid in range(1, n+1):
        s = int(sizes[cid-1])
        if s < 200:
            continue
        ys, xs = np.where(lab == cid)
        comps.append((s, int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())))
    comps.sort(key=lambda c: -c[0])
    return comps[:6]

for f in [0, 6, 8, 10, 12, 14, 20]:
    print(f"frame {f:02d}:", eye_comps(rf"C:\Users\24260\Desktop\教育agent\rocket_rig\frame_{f:02d}.png"))