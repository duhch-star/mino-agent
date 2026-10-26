from PIL import Image
import numpy as np

for name in ["eye_00", "eye_05", "eye_10"]:
    img = Image.open(rf"C:\Users\24260\Desktop\教育agent\rocket_rig\{name}.png").convert("RGB")
    a = np.asarray(img).astype(np.float32)
    lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]
    h, w = lum.shape
    dark = lum < 140
    # column density profile across middle rows to find the two eyes
    rows = np.arange(h)
    mid_mask = (rows > h*0.3) & (rows < h*0.75)
    col = dark[mid_mask].sum(axis=0)
    # find left and right eye x-centers: two peaks
    # just report per-row dark count in the middle 60% width, and the y-extent
    print(f"--- {name}: dark total={int(dark.sum())}")
    # horizontal profile: dark column counts (max per col)
    # vertical profile: dark counts per row
    rowprof = dark.astype(int).sum(axis=1)
    # print mean lum of central area
    print("   mean lum center:", round(float(lum[300:700, 300:700].mean()),1))