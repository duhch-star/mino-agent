import bpy
rna = bpy.ops.export_scene.gltf.get_rna_type()
with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\defaults.txt","w") as f:
    for pid in ["export_morph","export_morph_animation","export_morph_normal","export_image_format","export_image_quality","export_animation_mode","export_force_sampling"]:
        p = rna.properties[pid]
        f.write(f"{pid} = {p.default}\n")
