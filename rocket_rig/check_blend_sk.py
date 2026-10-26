import bpy, numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
print("shape keys:", [k.name for k in sk.key_blocks] if sk else None)

# inspect the Blink key deltas directly
if sk:
    b = sk.key_blocks["Basis"]
    k = sk.key_blocks["Blink"]
    diffs = []
    for i in range(0, len(mesh_obj.data.vertices), 1):
        d = (k.data[i].co[0]-b.data[i].co[0], k.data[i].co[1]-b.data[i].co[1], k.data[i].co[2]-b.data[i].co[2])
        m = max(abs(x) for x in d)
        if m > 1e-5:
            diffs.append((i, m, d))
        if len(diffs) > 5:
            break
    print("first non-zero deltas:", diffs[:5], "total checked up to idx", i)
    # count affected
    import itertools
    cnt = 0
    for i in range(0, len(mesh_obj.data.vertices), 100):
        d = (k.data[i].co[0]-b.data[i].co[0], k.data[i].co[1]-b.data[i].co[1], k.data[i].co[2]-b.data[i].co[2])
        if max(abs(x) for x in d) > 1e-5:
            cnt += 1
    print("sampled affected every 100:", cnt)

# measure deformation at value 1.0
def span():
    verts = np.zeros((len(mesh_obj.data.vertices), 3), dtype=np.float32)
    mesh_obj.data.vertices.foreach_get("co", verts.ravel())
    sel = verts[:, 1] < -0.09
    sub = verts[sel]
    eyeL = sub[(np.abs(sub[:,0]+0.041)<0.06) & (np.abs(sub[:,2]-0.117)<0.06)]
    return eyeL[:,2].max()-eyeL[:,2].min(), len(eyeL)

for val in (0.0, 1.0):
    sk.key_blocks["Blink"].value = val
    bpy.context.view_layer.update()
    s, n = span()
    print(f"value={val}: eyeL z-span {s:.4f} n={n}")