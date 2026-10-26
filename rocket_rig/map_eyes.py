from PIL import Image
import numpy as np

data = np.load(r"C:\Users\24260\Desktop\教育agent\rocket_rig\geo.npz")
verts = data["verts"]
uv = data["uv"]
tris = data["tris"]
print("verts", verts.shape, "uv range", uv.min(0), uv.max(0))

# object bounds
print("bounds", verts.min(0), verts.max(0))

# Load base color, sample at UV coords (note: Blender UV y=0 bottom -> texture row = (1-v)*(H-1))
img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png").convert("RGB")
W, H = img.size
a = np.asarray(img).astype(np.float32)
lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114)

# Only sample vertices with UV inside [0,1]
ok = (uv[:, 0] >= 0) & (uv[:, 0] < 1) & (uv[:, 1] >= 0) & (uv[:, 1] < 1)
print("uv ok fraction", ok.mean())

u = uv[ok, 0] * (W - 1)
v = (1.0 - uv[ok, 1]) * (H - 1)
ui = np.clip(u.astype(np.int64), 0, W - 1)
vi = np.clip(v.astype(np.int64), 0, H - 1)
vtx_lum = lum[vi, ui]
vtx_xyz = verts[ok]

# Front-facing vertices: normal approx via position — rocket faces +Z? Let's see which hemisphere has dark eye pixels.
# The model bound x [-0.439, 0.439], y [-0.166, 0.166], z [-0.5, 0.5]. Reference image shows eyes on the "front".
# Use vertex position: the face likely at +Z (front) or -Z. Check both.
for axis, sign, label in [("z", 1.0, "+Z"), ("z", -1.0, "-Z"), ("x", 1.0, "+X"), ("x", -1.0, "-X")]:
    col = verts[ok, {"x": 0, "y": 1, "z": 2}[axis]]
    sel = col * sign > 0.2
    d = vtx_lum[sel]
    print(f"{label} hemisphere: {sel.sum()} verts, dark(<60) { (d<60).sum() }, mean {d.mean():.1f}")

# Report clusters of very dark vertices in +Z front region
dark = vtx_lum < 70
print("total dark verts (all dirs):", dark.sum())
if dark.sum():
    dark_xyz = vtx_xyz[dark]
    print("dark xyz mean:", dark_xyz.mean(0).round(3))
    print("dark xyz std:", dark_xyz.std(0).round(3))
    # 2D histogram on XZ plane (front projection) to find eye pair
    import collections
    q = (dark_xyz[:, [0, 2]] / 0.02).astype(int)
    cnt = collections.Counter(map(tuple, q))
    top = cnt.most_common(30)
    for k, c in top:
        print("  cell", (k[0] * 0.02, k[1] * 0.02), "count", c)
