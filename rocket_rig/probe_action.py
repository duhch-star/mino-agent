import bpy
a = bpy.data.actions.new("T")
print("Action attrs:", [x for x in dir(a) if not x.startswith("_")][:60])
print("has fcurves:", hasattr(a, "fcurves"))
import bpy.types as T
print("ActionFCurves type:", hasattr(T, "ActionFCurves"))
print([x for x in dir(T) if "ction" in x and "Curve" in x])
