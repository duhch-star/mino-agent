import bpy, json, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"

# ---- load rigged blend and inspect shape key state ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys
print("BLEND mesh:", mesh_obj.name, "shape_keys:", [k.name for k in sk.key_blocks] if sk else None)
if sk:
    for k in sk.key_blocks:
        print("  key", k.name, "value", k.value, "relative", k.relative_key.name, "mute", k.mute)
    print("  sk.animation_data action:", sk.animation_data.action.name if sk.animation_data and sk.animation_data.action else None)
dg = bpy.context.evaluated_depsgraph_get()
ev = mesh_obj.evaluated_get(dg)
print("  evaluated mesh shape_keys:", [k.name for k in ev.data.shape_keys.key_blocks] if ev.data.shape_keys else None)

# ---- tiny export test: cube + morph + action ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1.0)
cube = bpy.context.object
key = cube.shape_key_add(name="Big")
# make it big: scale cube verts 1.5x
basis = cube.data.shape_keys.key_blocks[0]
for i, v in enumerate(basis.data):
    key.data[i].co = (v.co[0]*1.5, v.co[1]*1.5, v.co[2])
sk2 = cube.data.shape_keys
sk2.animation_data_create()
a = bpy.data.actions.new("Grow")
sk2.animation_data.action = a
fcu = a.fcurve_ensure_for_datablock(sk2, 'key_blocks["Big"].value', index=0)
frm = [(0,0.0),(6,1.0),(12,1.0),(18,0.0)]
fcu.keyframe_points.add(len(frm))
for i,(f,v) in enumerate(frm):
    fcu.keyframe_points[i].co = (f,v)

dst = os.path.join(OUT, "test_morph.glb")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                          export_apply=True, export_morph=True, export_morph_animation=True,
                          export_animation_mode="ACTIONS", export_image_format="NONE")
print("TINY EXPORT DONE")