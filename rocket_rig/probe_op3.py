import bpy
rna = bpy.ops.export_scene.gltf.get_rna_type()
for pid in ["export_morph","export_morph_animation","export_morph_normal","export_image_format","export_animation_mode","export_animations","export_image_quality","export_jpeg_quality","export_extra_animations","export_merge_animation"]:
    p = rna.properties[pid]
    if p.type in ("BOOLEAN","INT"):
        print(pid, "=", p.default)
    elif p.type == "ENUM":
        print(pid, "=", p.default, [(e.identifier, e.name) for e in p.enum_items])
