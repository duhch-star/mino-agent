from PIL import Image
import numpy as np
from scipy import ndimage

img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png").convert("RGB")
a = np.asarray(img)
h, w, _ = a.shape
lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114).astype(np.float32)

# Eye candidates: very dark pixels (pupil/outline intensity) that are NOT pure-black background.
# Let's first check what fraction of the texture is actually used (alpha/coverage) and the color histogram.
alpha = np.asarray(Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png").convert("RGBA"))[..., 3]
print("alpha min/max/mean:", alpha.min(), alpha.max(), alpha.mean().round(2))
print("fraction transparent:", (alpha < 128).mean().round(4))

# colors histogram on opaque pixels
opaque = alpha > 128
cols = a[opaque]
print("opaque count:", opaque.sum())
for name, sel in [("very dark", lum[opaque] < 40), ("dark", (lum[opaque]>=40)&(lum[opaque]<90)), ("mid", (lum[opaque]>=90)&(lum[opaque]<160)), ("bright", lum[opaque]>=160)]:
    print(name, sel.sum())

# connected components of very dark pixels (candidate pupils / mouth)
dark = (lum < 55) & opaque
lab, n = ndimage.label(dark)
sizes = ndimage.sum(dark, lab, range(1, n+1))
cands = [(i+1, int(s)) for i, s in enumerate(sizes) if 50 <= s <= 500000]
print("components in [50, 500k]:", len(cands))
cands.sort(key=lambda c: -c[1])
for cid, s in cands[:25]:
    ys, xs = np.where(lab == cid)
    print(f"  id={cid} size={s} bbox x={xs.min()}-{xs.max()} y={ys.min()}-{ys.max()} ratio={(ys.max()-ys.min()+1)/(xs.max()-xs.min()+1):.2f}")