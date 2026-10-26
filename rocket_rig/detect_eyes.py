from PIL import Image
import numpy as np, json

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
data = np.load(OUT + r"\geo.npz")
verts = data["verts"]
uv = data["uv"]

img = Image.open(OUT + r"\Image_0.png").convert("RGB")
W, H = img.size
a = np.asarray(img).astype(np.float32)
lum = 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]

u = np.clip(uv[:,0]*(W-1), 0, W-1).astype(np.int64)
v = np.clip((1.0-uv[:,1])*(H-1), 0, H-1).astype(np.int64)
vtx_lum = lum[v, u]
dark = vtx_lum < 90.0

EYES = {
    "EyeL": np.array([-0.041, -0.140, 0.117]),
    "EyeR": np.array([0.081, -0.153, 0.105]),
}
face_mask = verts[:, 1] < -0.08
result = {}
for name, c in EYES.items():
    dx = np.abs(verts[:, 0] - c[0])
    dz = np.abs(verts[:, 2] - c[2])
    in_xz = np.sqrt(dx**2 + dz**2)
    core = dark & face_mask & (in_xz < 0.05)
    ring = face_mask & (in_xz < 0.10) & (in_xz >= 0.05)
    core_idx = np.where(core)[0].tolist()
    ring_idx = np.where(ring)[0].tolist()
    result[name] = {"center": c.tolist(), "core": core_idx, "ring": ring_idx,
                    "core_n": len(core_idx), "ring_n": len(ring_idx)}
    print(name, "core", len(core_idx), "ring", len(ring_idx))
    if core_idx:
        sub = verts[np.array(core_idx)]
        print("  x", round(sub[:,0].min(),3), round(sub[:,0].max(),3),
              "z", round(sub[:,2].min(),3), round(sub[:,2].max(),3),
              "y", round(sub[:,1].min(),3), round(sub[:,1].max(),3))

with open(OUT + r"\eyes.json", "w") as f:
    json.dump(result, f)
print("DONE")