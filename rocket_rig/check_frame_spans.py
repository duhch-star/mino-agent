import bpy, json, numpy as np

with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eyes.json") as f:
    eyes = json.load(f)
coreL = np.array(eyes["EyeL"]["core"], dtype=np.int64)
coreR = np.array(eyes["EyeR"]["core"], dtype=np.int64)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
scene = bpy.context.scene
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
dg = bpy.context.evaluated_depsgraph_get()

def core_span_at_frame(f):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    sL = verts[coreL][:,2].max() - verts[coreL][:,2].min()
    sR = verts[coreR][:,2].max() - verts[coreR][:,2].min()
    return float(sL), float(sR)

for f in range(0, 16):
    sL, sR = core_span_at_frame(f)
    print(f"frame {f:02d}: EyeL core z-span={sL:.4f}  EyeR core z-span={sR:.4f}")