from PIL import Image
import numpy as np

img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png").convert("RGB")
print("size", img.size)
a = np.asarray(img).astype(np.int32)
h, w, _ = a.shape
lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114)

# find dark blobs (eyes, mouth, outlines): luminance < 60
mask = (lum < 60) & (lum > 0)  # exclude pure black background pixels? keep all dark
ys, xs = np.where(lum < 55)
print("dark pixels:", len(xs))
if len(xs):
    print("dark bbox x:", xs.min(), xs.max(), "y:", ys.min(), ys.max())

# save a small preview at 512x512
small = img.resize((512, 512), Image.LANCZOS)
small.save(r"C:\Users\24260\Desktop\教育agent\rocket_rig\tex_preview.png")

# also check Image_1 characteristics
img1 = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_1.png").convert("RGB")
a1 = np.asarray(img1).astype(np.int32)
print("Image_1 size", img1.size, "mean", a1.mean(axis=(0,1)).round(1), "std", a1.std(axis=(0,1)).round(1))