import bpy, json, numpy as np

with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\eyes.json") as f:
    eyes = json.load(f)
coreL = np.array(eyes["EyeL"]["core"], dtype=np.int64)
coreR = np.array(eyes["EyeR"]["core"], dtype=np.int64)
print("core sizes", len(coreL), len(coreR))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
b = sk.key_blocks["Basis"]
k = sk.key_blocks["Blink"]

verts = np.zeros((len(mesh_obj.data.vertices), 3), dtype=np.float32)
mesh_obj.data.vertices.foreach_get("co", verts.ravel())

print("idx | mesh co | basis co | blink co | delta(blink-basis)")
for i in coreL[:8]:
    mc = verts[i]
    bc = tuple(round(x,4) for x in b.data[i].co)
    kc = tuple(round(x,4) for x in k.data[i].co)
    print(i, [round(x,4) for x in mc], bc, kc, [round(k.data[i].co[j]-b.data[i].co[j],5) for j in range(3)])
print("...")
for i in coreL[120:126]:
    mc = verts[i]
    bc = tuple(round(x,4) for x in b.data[i].co)
    kc = tuple(round(x,4) for x in k.data[i].co)
    print(i, [round(x,4) for x in mc], bc, kc, [round(k.data[i].co[j]-b.data[i].co[j],5) for j in range(3)])