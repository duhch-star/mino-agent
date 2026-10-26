import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")

for obj in bpy.data.objects:
    print("OBJ", obj.name, obj.type)
    if obj.animation_data:
        ad = obj.animation_data
        print("  anim_data action:", ad.action.name if ad.action else None)
        print("  nla_tracks:", [ (tr.name, [s.action.name if s.action else None for s in tr.strips]) for tr in ad.nla_tracks])
    if obj.type == "MESH" and obj.data.shape_keys:
        print("  sk anim action:", obj.data.shape_keys.animation_data.action.name if obj.data.shape_keys.animation_data and obj.data.shape_keys.animation_data.action else None)
        print("  sk nla:", [tr.name for tr in obj.data.shape_keys.animation_data.nla_tracks] if obj.data.shape_keys.animation_data else None)
        print("  sk action slots:", len(obj.data.shape_keys.animation_data.action_slots) if obj.data.shape_keys.animation_data and obj.data.shape_keys.animation_data.action else None)

print("\nALL ACTIONS:")
for a in bpy.data.actions:
    fcs = []
    try:
        for l in a.layers:
            pass
    except Exception:
        pass
    print(" action", a.name, "users", a.users, "slots:", [ (s.target_id_type, s.target_id_name) for s in a.slots] if a.slots else None)