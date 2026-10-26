import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")
m = next(o for o in bpy.data.objects if o.type=="MESH").data
print("has_custom_normals:", getattr(m, "has_custom_normals", "N/A"))
print("use_auto_smooth:", getattr(m, "use_auto_smooth", "N/A"))
print("attributes:", [a.name for a in m.attributes][:20])
# check normal domain
for a in m.attributes:
    if "normal" in a.name.lower():
        print("attr", a.name, "domain", a.domain, "type", a.data_type)
# loop normals count
print("loops:", len(m.loops), "verts:", len(m.vertices))
