import bpy, math, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 800
scene.render.resolution_y = 800

w = bpy.data.worlds.new("W")
w.use_nodes = True
bsdf = w.node_tree.nodes.get("Background")
bsdf.inputs[0].default_value = (0.9, 0.9, 0.9, 1.0)
bsdf.inputs[1].default_value = 1.0
scene.world = w

key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key.location = (1.0, -1.0, 1.2)
key.data.energy = 150
key.data.size = 2.0
scene.collection.objects.link(key)

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

# close-up of the eye region (face on -Y side)
render_view("closeup_eyes", (0, -0.45, 0.11), (0, -0.15, 0.11))
# mid region (mouth band)
render_view("closeup_mid", (0, -0.45, 0.2), (0, -0.14, 0.2))
# lower columns
render_view("closeup_low", (0, -0.45, -0.05), (0, -0.12, -0.05))
# top band
render_view("closeup_top", (0, -0.45, 0.32), (0, -0.08, 0.32))
print("CLOSEUP DONE")