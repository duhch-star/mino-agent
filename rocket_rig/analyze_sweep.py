from PIL import Image
import numpy as np

def eye_metrics(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]
    h, w = lum.shape
    dark = lum < 100
    # in the closeup, eye ellipses are around x 200-320 (left) and 630-770 (right), mid-height
    # vertical dark-pixel density profile per eye column band
    def band_metrics(x0, x1):
        b = dark[:, x0:x1]
        col_prof = b.sum(axis=1)  # per row dark count
        # find contiguous rows where eye (dark) is present: rows with >5 dark px
        present = col_prof > 5
        if not present.any():
            return 0, 0, 0
        ys = np.where(present)[0]
        height = ys.max() - ys.min() + 1
        return int(b.sum()), height, int(col_prof.max())
    return band_metrics(180, 330), band_metrics(620, 780)

for f in [0, 6, 8, 10, 12, 14, 20]:
    m = eye_metrics(rf"C:\Users\24260\Desktop\教育agent\rocket_rig\frame_{f:02d}.png")
    print(f"frame {f:02d}: L(darkpx,height,rowmax)={m[0]}  R={m[1]}")