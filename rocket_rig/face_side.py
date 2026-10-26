from PIL import Image
import numpy as np

data = np.load(r"C:\Users\24260\Desktop\教育agent\rocket_rig\geo.npz")
verts = data["verts"]
uv = data["uv"]

img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png").convert("RGB")
W, H = img.size
a = np.asarray(img).astype(np.float32)
r, g, b = a[...,0], a[...,1], a[...,2]
lum = 0.299*r + 0.587*g + 0.114*b

u = np.clip(uv[:,0]*(W-1), 0, W-1).astype(np.int64)
v = np.clip((1.0-uv[:,1])*(H-1), 0, H-1).astype(np.int64)
vtx_lum = lum[v, u]
vtx_r = r[v,u]; vtx_g = g[v,u]; vtx_b = b[v,u]

white = vtx_lum > 200
dark = vtx_lum < 70

for side, sel in [("+Z", verts[:,2] > 0.25), ("-Z", verts[:,2] < -0.25),
                  ("+X", verts[:,0] > 0.25), ("-X", verts[:,0] < -0.25),
                  ("+Y", verts[:,1] > 0.08), ("-Y", verts[:,1] < -0.08)]:
    n = int(sel.sum())
    sl = np.where(sel)[0]
    w = int(white[sl].sum())
    d = int(dark[sl].sum())
    print(f"{side}: n={n:7d} white={w:6d} ({100*w/max(n,1):4.1f}%) dark={d:6d} ({100*d/max(n,1):4.1f}%) lum_mean={vtx_lum[sl].mean():.0f}")

# look at the -Z and +Z hemisphere color content
for side, sel in [("-Z", verts[:,2] < -0.25), ("+Z", verts[:,2] > 0.25)]:
    means = [vtx_r[sel].mean(), vtx_g[sel].mean(), vtx_b[sel].mean()]
    print(side, "mean color", np.round(means, 0))