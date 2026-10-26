import json, numpy as np
from PIL import Image

with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eyes.json") as f:
    eyes = json.load(f)

data = np.load(r"C:\Users\24260\Desktop\教育agent\rocket_rig\geo.npz")
uv = data["uv"]  # (1M, 2) per-vertex avg uv

img = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\Image_0.png")
W, H = img.size
print("texture", W, H)

def dump_eye(name):
    core = np.array(eyes[name]["core"])
    ring = np.array(eyes[name]["ring"])
    allv = np.concatenate([core, ring])
    u = uv[allv]
    print(f"--- {name}: n_core={len(core)} n_ring={len(ring)}")
    print("  uv range u[{:.4f},{:.4f}] v[{:.4f},{:.4f}]".format(u[:,0].min(), u[:,0].max(), u[:,1].min(), u[:,1].max()))
    # pixel bbox with margin
    x0 = int(u[:,0].min()*W) - 40; x1 = int(u[:,0].max()*W) + 40
    y0 = int((1-u[:,1].max())*H) - 40; y1 = int((1-u[:,1].min())*H) + 40
    x0=max(x0,0); y0=max(y0,0); x1=min(x1,W); y1=min(y1,H)
    crop = img.crop((x0, y0, x1, y1))
    crop = crop.resize((crop.width//4, crop.height//4), Image.LANCZOS)
    p = rf"C:\Users\24260\Desktop\教育agent\rocket_rig\eye_tex_{name}.png"
    crop.save(p)
    print("  saved", p, crop.size, "bbox px", (x0,y0,x1,y1))

dump_eye("EyeL")
dump_eye("EyeR")