import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# mesh with shape key
me = bpy.data.meshes.new("M")
me.from_pydata([(0,0,0),(1,0,0),(0,1,0)], [], [(0,1,2)])
o = bpy.data.objects.new("O", me)
sc.collection.objects.link(o)
kb = o.shape_key_add(name="Blink")
print("key_blocks on object:", hasattr(o, "key_blocks"))
act = bpy.data.actions.new("Blink")
o.animation_data_create()
o.animation_data.action = act
try:
    o.keyframe_insert(data_path='key_blocks["Blink"].value', frame=5)
    print("obj shapekey kfi ok; channels:", len(act.layers[0].channelbag.fcurves))
except Exception as e:
    print("obj shapekey kfi err:", repr(e))

# armature
arm_data = bpy.data.armatures.new("Rig")
arm = bpy.data.objects.new("Rig", arm_data)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones.new("B1")
eb.head = (0,0,0); eb.tail = (0,0,1)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.objects.active = arm
act2 = bpy.data.actions.new("Idle")
arm.animation_data_create()
arm.animation_data.action = act2
try:
    arm.keyframe_insert(data_path='pose.bones["B1"].rotation_euler', frame=5, index=2)
    print("bone kfi ok; channels:", len(act2.layers[0].channelbag.fcurves))
except Exception as e:
    print("bone kfi err:", repr(e))
