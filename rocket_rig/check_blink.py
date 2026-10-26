from PIL import Image
import numpy as np

def eye_darkness(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]
    h, w = lum.shape
    # eye centers in this closeup (camera at (0,-0.45,0.11) tracking (0,-0.15,0.11), 50mm, 800px)
    # World X -> image X via perspective; roughly: eyeL world (-0.041, z 0.117) vs center (0, 0.11)
    # Just scan horizontally across the middle for dark blobs.
    # Find dark pixels (lum < 100) rows 200..600
    mask = lum < 100
    rows = np.arange(h)
    row_dark = mask.sum(axis=1)
    mid = int(h*0.5)
    print(f"{path}: dark px total {(mask).sum()}, in central band (rows 250-550) {mask[250:550,:].sum()}")
    # column profile in central band
    band = mask[250:550, :]
    col_dark = band.sum(axis=0)
    # find dark column runs > 10 px
    runs = []
    in_run = False
    for x, v in enumerate(col_dark):
        if v > 15 and not in_run:
            start = x; in_run = True
        elif v <= 15 and in_run:
            runs.append((start, x-1, int(col_dark[start:x].max())))
            in_run = False
    if in_run:
        runs.append((start, len(col_dark)-1, int(col_dark[start:].max())))
    big = [r for r in runs if (r[1]-r[0]) >= 8]
    print("  dark column runs (x0,x1,maxh):", big[:12])

for name in ["blink_open", "blink_closed"]:
    eye_darkness(r"C:\Users\24260\Desktop\教育agent\rocket_rig\%s.png" % name)