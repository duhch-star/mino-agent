import bpy, numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
scene = bpy.context.scene
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
print("keys:", [k.name for k in sk.key_blocks])

dg = bpy.context.evaluated_depsgraph_get()

def iris_spans(val):
    sk.key_blocks["Blink"].value = val
    bpy.context.view_layer.update()
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    selL = (np.abs(verts[:,0]+0.041)<0.03) & (np.abs(verts[:,1]+0.140)<0.03) & (np.abs(verts[:,2]-0.117)<0.035)
    selR = (np.abs(verts[:,0]-0.081)<0.03) & (np.abs(verts[:,1]+0.153)<0.03) & (np.abs(verts[:,2]-0.105)<0.035)
    sL = verts[selL][:,2].max()-verts[selL][:,2].min() if selL.any() else -1
    sR = verts[selR][:,2].max()-verts[selR][:,2].min() if selR.any() else -1
    return float(sL), float(sR), int(selL.sum()), int(selR.sum())

for v in (0.0, 1.0):
    sL, sR, nL, nR = iris_spans(v)
    print(f"Blink value={v}: EyeL iris z-span={sL:.4f} (n={nL})  EyeR iris z-span={sR:.4f} (n={nR})")