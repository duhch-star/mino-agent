import bpy, math, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

# dump node tree links
res = []
for mat in bpy.data.materials:
    if mat.node_tree is None:
        continue
    for node in mat.node_tree.nodes:
        ins = {}
        for inp in node.inputs:
            for l in inp.links:
                ins[inp.name] = l.from_node.name + "." + l.from_socket.name
        outs = {}
        for o in node.outputs:
            for l in o.links:
                outs[o.name] = l.to_node.name + "." + l.to_socket.name
        res.append({"mat": mat.name, "node": node.type, "name": node.name, "inputs": ins, "outputs": outs})
with open(os.path.join(OUT, "material_nodes.json"), "w", encoding="utf-8") as f:
    import json
    json.dump(res, f, ensure_ascii=False, indent=1)

# === brighter render ===
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 960
scene.render.resolution_y = 960

# white world background
w = bpy.data.worlds.new("W2")
w.use_nodes = True
bsdf = w.node_tree.nodes.get("Background")
bsdf.inputs[0].default_value = (0.9, 0.9, 0.9, 1.0)
bsdf.inputs[1].default_value = 1.0
scene.world = w

key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key.location = (1.2, -1.2, 1.5)
key.rotation_euler = (math.radians(50), math.radians(10), math.radians(-40))
key.data.energy = 200
key.data.size = 2.0
scene.collection.objects.link(key)

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
fill.location = (-0.8, 0.9, 0.6)
fill.rotation_euler = (math.radians(60), 0, math.radians(150))
fill.data.energy = 80
fill.data.size = 2.0
scene.collection.objects.link(fill)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
target = bpy.data.objects.new("Target", None)
scene.collection.objects.link(target)

def render_view(name, cam_loc, target_loc):
    cam.location = cam_loc
    target.location = target_loc
    track = cam.constraints.new(type="TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    cam.constraints.clear()

render_view("view2_front", (0, -1.6, 0), (0, 0, 0.1))
render_view("view2_threequarter", (1.0, -1.2, 0.5), (0, 0, 0.3))
render_view("view2_side", (1.6, 0, 0), (0, 0, 0.1))
print("RENDER2 DONE")