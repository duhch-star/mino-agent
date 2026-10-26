import bpy, os, numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
print("shape keys:", [k.name for k in sk.key_blocks] if sk else None)

def eye_region_span():
    verts = np.zeros((len(mesh_obj.data.vertices), 3), dtype=np.float32)
    mesh_obj.data.vertices.foreach_get("co", verts.ravel())
    # face region verts: y < -0.09
    sel = verts[:, 1] < -0.09
    sub = verts[sel]
    # eye boxes
    eyeL = sub[(np.abs(sub[:,0]+0.041)<0.06) & (np.abs(sub[:,2]-0.117)<0.06)]
    eyeR = sub[(np.abs(sub[:,0]-0.081)<0.06) & (np.abs(sub[:,2]-0.105)<0.06)]
    return eyeL, eyeR

for val in (0.0, 1.0):
    sk.key_blocks["Blink"].value = val
    bpy.context.view_layer.update()
    L, R = eye_region_span()
    print(f"value={val}: eyeL z-span {L[:,2].max()-L[:,2].min():.4f}  eyeR z-span {R[:,2].max()-R[:,2].min():.4f}  | eyeL n={len(L)} eyeR n={len(R)}")