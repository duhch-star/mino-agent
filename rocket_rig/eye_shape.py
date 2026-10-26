from PIL import Image
import numpy as np
from scipy import ndimage

img = np.asarray(Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_open_final.png").convert("RGB")).astype(np.float32)
lum = 0.299*img[...,0]+0.587*img[...,1]+0.114*img[...,2]

# left eye region from earlier: x 189-327, y 267-470; right: x 634-772, y 307-522
for name, (x0,x1,y0,y1) in {"L":(189,327,267,470), "R":(634,772,307,522)}.items():
    sub = lum[y0:y1, x0:x1]
    dark = sub < 140
    # pixel density rows and cols
    rowp = dark.sum(axis=1)
    colp = dark.sum(axis=0)
    ys = np.where(rowp > 0)
    xs = np.where(colp > 0)
    print(f"{name} eye: dark {int(dark.sum())} px  rows(y0-{y0}) {int(ys[0].min())}-{int(ys[0].max())}  cols(x0-{x0}) {int(xs[0].min())}-{int(xs[0].max())}")
    # vertical profile: find peaks -> separate components (pupil vs brow)
    # threshold row profile to find distinct bands
    bands = []
    in_b = False
    for r, v in enumerate(rowp):
        if v > 5 and not in_b:
            in_b = True; s = r
        elif v <= 5 and in_b:
            bands.append((s, r-1, int(rowp[s:r].max()))); in_b = False
    if in_b:
        bands.append((s, len(rowp)-1, int(rowp[s:].max())))
    print(f"  {name} dark row bands (rel y0={y0}):", bands)