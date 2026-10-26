import bpy
rna = bpy.ops.export_scene.gltf.get_rna_type()
props = []
for p in rna.properties:
    if p.identifier not in ("filepath","check_existing"):
        props.append((p.identifier, str(p.type)))
print(sorted(props))
