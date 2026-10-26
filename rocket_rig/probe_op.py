import bpy
op = bpy.ops.export_scene.gltf
import types
props = [x for x in dir(op) if not x.startswith("_") and x not in ("bl_rna","rna_type","as_keywords","poll","idname","idname_py","description","description_py","type","name","translate","use_translate")] 
print("props:", props)
import rna_prop
