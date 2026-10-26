import bpy, os, json

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
GLB = r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

info = {"objects": [], "animations": []}
for obj in bpy.data.objects:
    d = {"name": obj.name, "type": obj.type}
    if obj.type == "MESH":
        d["shape_keys"] = [k.name for k in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else []
        d["modifiers"] = [m.type for m in obj.modifiers]
        d["parents"] = obj.parent.name if obj.parent else None
    if obj.type == "ARMATURE":
        d["bones"] = [b.name for b in obj.data.bones]
    info["objects"].append(d)
for a in bpy.data.actions:
    info["animations"].append({"name": a.name, "frame_range": [int(x) for x in a.frame_range]})
print(json.dumps(info, indent=1))

# render open (frame 0) and closed (frame 9) eye states
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 800
scene.render.resolution_y = 800
w = bpy.data.worlds.new("W")
w.use_nodes = True
w.node_tree.nodes.get("Background").inputs[0].default_value = (0.9,0.9,0.9,1.0)
scene.world = w
key = bpy.data.objects.new("Key", bpy.data.lights.new("Key","AREA"))
key.location = (1.0,-1.0,1.2); key.data.energy = 150; key.data.size = 2.0
scene.collection.objects.link(key)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 50; cam.location = (0,-0.45,0.11)
t = bpy.data.objects.new("T", None); scene.collection.objects.link(t); t.location = (0,-0.15,0.11)
tr = cam.constraints.new(type="TRACK_TO"); tr.target = t; tr.track_axis="TRACK_NEGATIVE_Z"; tr.up_axis="UP_Y"

for fname, frame in [("blink_open", 0), ("blink_closed", 9)]:
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT, fname + ".png")
    bpy.ops.render.render(write_still=True)
print("VERIFY DONE")