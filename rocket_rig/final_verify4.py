import bpy, numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
scene = bpy.context.scene
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
dg = bpy.context.evaluated_depsgraph_get()

def get_eval_positions():
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    return verts.reshape(-1, 3)

sk.key_blocks["Blink"].value = 0.0
bpy.context.view_layer.update()
P0 = get_eval_positions()
sk.key_blocks["Blink"].value = 1.0
bpy.context.view_layer.update()
P1 = get_eval_positions()

d = np.linalg.norm(P1 - P0, axis=1)
print("total verts:", len(d))
print("verts with |disp|>1e-4:", int((d > 1e-4).sum()))
print("verts with |disp|>1e-3:", int((d > 1e-3).sum()))
print("max disp:", float(d.max()))

# eye region displacements: verts whose REST position is in the two iris boxes
selL = (np.abs(P0[:,0]+0.041)<0.03) & (np.abs(P0[:,1]+0.140)<0.03) & (np.abs(P0[:,2]-0.117)<0.05)
selR = (np.abs(P0[:,0]-0.081)<0.03) & (np.abs(P0[:,1]+0.153)<0.03) & (np.abs(P0[:,2]-0.105)<0.05)
for name, sel in (("EyeL", selL), ("EyeR", selR)):
    sub = d[sel]
    print(f"{name}: n={int(sel.sum())} mean|disp|={sub.mean():.5f} max|disp|={sub.max():.5f} moved(>1e-4)={int((sub>1e-4).sum())}")

# where does the max displacement happen? print a few verts with big disp
big = np.argsort(d)[::-1][:5]
print("top displaced (rest pos, disp):")
for i in big:
    print("  ", np.round(P0[i],3), float(d[i]))