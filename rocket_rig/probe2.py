import bpy, inspect

# does Object.keyframe_insert still exist?
print("obj.keyframe_insert:", hasattr(bpy.types.Object, "keyframe_insert"))
print("obj.keyframe_delete:", hasattr(bpy.types.Object, "keyframe_delete"))

bpy.ops.wm.read_factory_settings(use_empty=True)
o = bpy.data.objects.new("C", None)
bpy.context.scene.collection.objects.link(o)
act = bpy.data.actions.new("A")
o.animation_data_create()
o.animation_data.action = act
print("is layered:", act.is_action_layered)
# try fcurve_ensure_for_datablock
sig = act.fcurve_ensure_for_datablock
print("ensure sig:", sig.__doc__ if sig.__doc__ else "no doc")[:400]
try:
    fc = act.fcurve_ensure_for_datablock(o.id_data, "location", index=0)
    print("fc returned:", type(fc))
except Exception as e:
    print("ensure err:", e)
# try keyframe_insert
try:
    o.location = (1,0,0)
    o.keyframe_insert(data_path="location", frame=10)
    print("kfi ok")
except Exception as e:
    print("kfi err:", e)
print("action fcurves now:", [ (str(k), len(k)) for k in act.layers[0].channelbag.fcurves] if act.layers else "none")
