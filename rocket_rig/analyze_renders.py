from PIL import Image
import numpy as np

def find_eye_candidates(path, label):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114)
    # background of EEVEE render: near black
    bg = lum < 12
    print(f"--- {label}: size {w}x{h}, bg fraction {bg.mean():.3f}, mean lum {lum.mean():.1f}")
    # face region: non-bg pixels
    fg = ~bg
    if fg.sum() == 0:
        print("  no foreground")
        return
    ys, xs = np.where(fg)
    print(f"  fg bbox x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}  (w {xs.max()-xs.min()+1}, h {ys.max()-ys.min()+1})")
    # dark blobs inside fg: luminance < 60
    dark = fg & (lum < 60)
    print(f"  dark-in-fg fraction: {dark.sum()/fg.sum():.3f}")

find_eye_candidates(r"C:\Users\24260\Desktop\教育agent\rocket_rig\view_front.png", "front")
find_eye_candidates(r"C:\Users\24260\Desktop\教育agent\rocket_rig\view_back.png", "back")
find_eye_candidates(r"C:\Users\24260\Desktop\教育agent\rocket_rig\view_side.png", "side")
find_eye_candidates(r"C:\Users\24260\Desktop\教育agent\rocket_rig\view_threequarter.png", "threequarter")