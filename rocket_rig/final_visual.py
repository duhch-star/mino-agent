import bpy, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
scene = bpy.context.scene
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys

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

for val, name in [(0.0, "blink_open_final"), (1.0, "blink_closed_final")]:
    sk.key_blocks["Blink"].value = val
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name, "value", val)
print("DONE")