import bpy, numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
print("keys:", [k.name for k in sk.key_blocks])

dg = bpy.context.evaluated_depsgraph_get()

def eval_eye_spans(val_label=None):
    if val_label is not None:
        sk.key_blocks["Blink"].value = val_label
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    sel = verts[:, 1] < -0.09
    sub = verts[sel]
    eyeL = sub[(np.abs(sub[:,0]+0.041)<0.05) & (np.abs(sub[:,2]-0.117)<0.05)]
    eyeR = sub[(np.abs(sub[:,0]-0.081)<0.05) & (np.abs(sub[:,2]-0.105)<0.05)]
    return (eyeL[:,2].max()-eyeL[:,2].min() if len(eyeL) else -1,
            eyeR[:,2].max()-eyeR[:,2].min() if len(eyeR) else -1)

print("value 0 :", eval_eye_spans(0.0))
print("value 1 :", eval_eye_spans(1.0))