import bpy, math, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

# Save the packed textures for analysis
for img in bpy.data.images:
    img.filepath_raw = os.path.join(OUT, img.name.replace("/", "_") + ".png")
    img.file_format = "PNG"
    img.save()

# scene setup
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("W")
scene.world.use_holdout = False
# add a simple sun + fill light so the model is visible without HDRI
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
fill.location = (0, -1.2, 0.4)
fill.rotation_euler = (math.radians(90), 0, 0)
fill.data.energy = 30
fill.data.size = 1.2
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

# front: look along -Y toward origin (model roughly at origin)
render_view("view_front", (0, -1.6, 0), (0, 0, 0.1))
render_view("view_back", (0, 1.6, 0), (0, 0, 0.1))
render_view("view_side", (1.6, 0, 0), (0, 0, 0.1))
render_view("view_threequarter", (1.0, -1.2, 0.5), (0, 0, 0.3))
print("RENDER DONE")
