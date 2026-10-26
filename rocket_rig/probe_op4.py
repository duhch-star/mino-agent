import bpy
rna = bpy.ops.export_scene.gltf.get_rna_type()
p = rna.properties["export_morph"]; print("export_morph =", p.default)
p = rna.properties["export_force_sampling"]; print("export_force_sampling =", p.default)
p = rna.properties["export_frame_range"]; print("export_frame_range =", p.default)
p = rna.properties["export_frame_step"]; print("export_frame_step =", p.default)
