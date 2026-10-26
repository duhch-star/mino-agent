import bpy, json, sys

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

out = {}
out["objects"] = []
for obj in bpy.data.objects:
    d = {
        "name": obj.name,
        "type": obj.type,
        "loc": [round(v, 4) for v in obj.location],
        "rot": [round(v, 4) for v in obj.rotation_euler],
        "scale": [round(v, 4) for v in obj.scale],
        "parent": obj.parent.name if obj.parent else None,
    }
    if obj.type == "MESH":
        m = obj.data
        d["verts"] = len(m.vertices)
        d["polys"] = len(m.polygons)
        d["uvs"] = [l.name for l in m.uv_layers]
        d["shape_keys"] = [k.name for k in m.shape_keys.key_blocks] if m.shape_keys else []
        d["materials"] = [mat.name if mat else None for mat in m.materials]
        d["bounds"] = [[round(v, 3) for v in pt] for pt in obj.bound_box]
        d["modifiers"] = [m.type for m in obj.modifiers]
    if obj.type == "ARMATURE":
        d["bones"] = [b.name for b in obj.data.bones]
    out["objects"].append(d)

out["materials"] = []
for mat in bpy.data.materials:
    d = {"name": mat.name, "nodes": []}
    if mat.node_tree:
        for node in mat.node_tree.nodes:
            d["nodes"].append(node.type)
    out["materials"].append(d)

out["images"] = []
for img in bpy.data.images:
    out["images"].append({"name": img.name, "size": [img.size[0], img.size[1]], "packed": img.packed_file is not None, "src": img.filepath})

out["animations"] = []
for a in bpy.data.actions:
    out["animations"].append({"name": a.name, "frames": [int(a.frame_range[0]), int(a.frame_range[1])], "fcurves": len(a.fcurves)})

with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\scene_info.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("DONE")
