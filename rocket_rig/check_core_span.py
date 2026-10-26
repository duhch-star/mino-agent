import bpy, json, numpy as np

with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eyes.json") as f:
    eyes = json.load(f)
coreL = np.array(eyes["EyeL"]["core"], dtype=np.int64)
coreR = np.array(eyes["EyeR"]["core"], dtype=np.int64)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
dg = bpy.context.evaluated_depsgraph_get()

def core_spans():
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    def span(idx):
        sub = verts[idx]
        return sub[:,2].max()-sub[:,2].min(), sub[:,2].mean()
    sL, mL = span(coreL)
    sR, mR = span(coreR)
    return sL, sR

for val in (0.0, 1.0):
    sk.key_blocks["Blink"].value = val
    bpy.context.view_layer.update()
    sL, sR = core_spans()
    print(f"value={val}: EyeL core z-span={sL:.5f}  EyeR core z-span={sR:.5f}")