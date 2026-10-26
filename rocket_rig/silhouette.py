import numpy as np

data = np.load(r"C:\Users\24260\Desktop\教育agent\rocket_rig\geo.npz")
verts = data["verts"]
print("overall bounds", verts.min(0), verts.max(0))

# silhouette: for each z-slice, x-extent and y-extent -> body outline profile
z = verts[:, 2]
bins = np.arange(-0.5, 0.52, 0.02)
profiles = []
for i in range(len(bins) - 1):
    sel = (z >= bins[i]) & (z < bins[i + 1])
    if sel.sum() == 0:
        continue
    sub = verts[sel]
    xspan = sub[:, 0].max() - sub[:, 0].min()
    yspan = sub[:, 1].max() - sub[:, 1].min()
    xmean = (sub[:, 0].min() + sub[:, 0].max()) / 2
    ymean = (sub[:, 1].min() + sub[:, 1].max()) / 2
    profiles.append((bins[i], xspan, yspan, xmean, ymean, sel.sum()))
print("z-slice, xspan, yspan, xmean, ymean, n")
for p in profiles:
    print(f"{p[0]:+.2f}  xspan={p[1]:.3f}  yspan={p[2]:.3f}  xmean={p[3]:+.3f}  ymean={p[4]:+.3f}  n={p[5]}")