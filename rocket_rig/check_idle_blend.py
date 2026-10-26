import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend")
scene = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("arm action:", arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None)
act = arm.animation_data.action
if act:
    print("action", act.name, "slot types:", [s.target_id_type for s in act.slots] if act.slots else "none")
    for layer in act.layers:
        pass

for f in (0, 20, 40, 60):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    chest = arm.pose.bones["Chest"]
    head = arm.pose.bones["Head"]
    root = arm.pose.bones["Root"]
    print(f"frame {f}: Root loc z={root.location.z:.4f}  Chest rot euler=({chest.rotation_euler.x:.3f},{chest.rotation_euler.y:.3f},{chest.rotation_euler.z:.3f})  Head rot euler=({head.rotation_euler.x:.3f},{head.rotation_euler.y:.3f},{head.rotation_euler.z:.3f})")