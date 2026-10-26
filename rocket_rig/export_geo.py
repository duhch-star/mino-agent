import bpy, os, json
import numpy as np

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

# node -> image mapping
mapping = {}
for mat in bpy.data.materials:
    if mat.node_tree is None:
        continue
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE":
            mapping[node.name] = node.image.name if node.image else None
with open(os.path.join(OUT, "node_image_map.json"), "w") as f:
    json.dump(mapping, f, indent=1)

mesh_obj = None
for obj in bpy.data.objects:
    if obj.type == "MESH":
        mesh_obj = obj
        break
mesh = mesh_obj.data
mesh.calc_loop_triangles()

verts = np.zeros((len(mesh.vertices), 3), dtype=np.float32)
mesh.vertices.foreach_get("co", verts.ravel())

# per-vertex UV: average loop UVs per vertex
uv = np.zeros((len(mesh.vertices), 2), dtype=np.float32)
count = np.zeros(len(mesh.vertices), dtype=np.int32)
uvl = mesh.uv_layers.active
loops = mesh.loops
n_loops = len(loops)
uvs = np.zeros((n_loops, 2), dtype=np.float32)
uvl.data.foreach_get("uv", uvs.ravel())
vidx = np.zeros(n_loops, dtype=np.int32)
loops.foreach_get("vertex_index", vidx)
np.add.at(uv, vidx, uvs)
np.add.at(count, vidx, 1)
count[count == 0] = 1
uv /= count[:, None]

tris = np.zeros((len(mesh.loop_triangles), 3), dtype=np.int32)
mesh.loop_triangles.foreach_get("vertices", tris.ravel())

np.savez_compressed(os.path.join(OUT, "geo.npz"),
                    verts=verts, uv=uv, tris=tris,
                    nloops=n_loops)
print("EXPORTED", verts.shape, tris.shape)
