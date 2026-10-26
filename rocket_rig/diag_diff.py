from PIL import Image
import numpy as np

op = np.asarray(Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eye_00.png").convert("RGB")).astype(np.float32)
cl = np.asarray(Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eye_10.png").convert("RGB")).astype(np.float32)

lum_op = 0.299*op[...,0]+0.587*op[...,1]+0.114*op[...,2]
lum_cl = 0.299*cl[...,0]+0.587*cl[...,1]+0.114*cl[...,2]
h, w = lum_op.shape

# 1) where does the eye DARK stay after closing? (dark in closed AND dark in open)
dark_op = lum_op < 140
dark_cl = lum_cl < 140
stay = dark_op & dark_cl
print("open dark:", int(dark_op.sum()), " closed dark:", int(dark_cl.sum()), " stayed dark:", int(stay.sum()))

# bounding box of stayed-dark in y (rows), split x into left/right halves
midx = w // 2
for label, sl in (("L", stay[:, :midx]), ("R", stay[:, midx:])):
    ys, xs = np.where(sl)
    if len(ys):
        print(f"  {label} stayed-dark rows {ys.min()}-{ys.max()} cols {xs.min()}-{xs.max()} n={len(ys)}")

# 2) significant-change regions (deformation) between open and closed
diff = np.abs(lum_op - lum_cl)
big = diff > 40
print("strong-change px:", int(big.sum()))
ys, xs = np.where(big)
print("  bbox of strong change: rows", ys.min(), "-", ys.max(), "cols", xs.min(), "-", xs.max())

# row profile of stayed-dark to see vertical extent pattern
prof = stay.sum(axis=1)
# print rows where stayed dark > 100
runs = []
in_run = False
for y, v in enumerate(prof):
    if v > 100 and not in_run:
        in_run = True; start = y
    elif v <= 100 and in_run:
        runs.append((start, y-1, int(prof[start:y].max()))); in_run = False
if in_run:
    runs.append((start, len(prof)-1, int(prof[start:].max())))
print("stayed-dark row runs (y0,y1,maxdensity):", runs[:8])