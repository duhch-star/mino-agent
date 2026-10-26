import bpy
# check the exporter's morph action collection logic
import inspect
src = inspect.getsource(bpy.ops.export_scene.gltf)
