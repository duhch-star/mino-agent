from PIL import Image
import numpy as np

img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\view2_front.png").convert("RGB")
a = np.asarray(img).astype(np.float32)
h, w, _ = a.shape
lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114)

# simple flood-fill BFS over dark pixels (lum<140 forces cover outlines too) using pure numpy queues
def label_dark(lum, thresh, min_size=200):
    mask = lum < thresh
    lab = np.zeros(lum.shape, dtype=np.int32)
    cur = 0
    idx = np.argwhere(mask)
    # efficient: iterate via stack on numpy is slow for 960x960, but ok with heuristic sampling
    # Use scipy
    from scipy import ndimage
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab, n, sizes

for thresh in (70, 100, 130, 160):
    lab, n, sizes = label_dark(lum, thresh)
    big = [(i + 1, int(sizes[i])) for i in range(n) if sizes[i] >= 300]
    big.sort(key=lambda c: -c[1])
    print(f"--- thresh {thresh}: {len(big)} blobs >=300px")
    for cid, s in big[:12]:
        ys, xs = np.where(lab == cid)
        cx, cy = xs.mean(), ys.mean()
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        print(f"  id={cid} size={s} center=({cx:.0f},{cy:.0f}) bbox={bw}x{bh} ratio={bh/bw:.2f}")

# also print average color of the front quadrant to guess what face looks like
print("\nmean color center area:", a[300:660, 330:630].mean(axis=(0,1)).round(0))