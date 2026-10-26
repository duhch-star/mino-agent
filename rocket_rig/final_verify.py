import bpy, os, numpy as np

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
scene = bpy.context.scene
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
sk = mesh_obj.data.shape_keys

# make Blink action active on shape_keys so frame evaluation drives it
ad = sk.animation_data
if ad.nla_tracks:
    track = ad.nla_tracks.get("Blink")
    if track and track.strips:
        sk.animation_data.action = track.strips[0].action
        ad.nla_tracks.remove(track)
print("sk action now:", sk.animation_data.action.name if sk.animation_data.action else None)

dg = bpy.context.evaluated_depsgraph_get()

def eye_span_by_pos(f):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    ev = mesh_obj.evaluated_get(dg)
    evd = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
    verts = np.zeros((len(evd.vertices), 3), dtype=np.float32)
    evd.vertices.foreach_get("co", verts.ravel())
    ev.to_mesh_clear()
    # eye verts by position: within 0.028 of each eye center (tight core box)
    selL = (np.abs(verts[:,0]+0.041)<0.028) & (np.abs(verts[:,1]+0.140)<0.028) & (np.abs(verts[:,2]-0.117)<0.05)
    selR = (np.abs(verts[:,0]-0.081)<0.028) & (np.abs(verts[:,1]+0.153)<0.028) & (np.abs(verts[:,2]-0.105)<0.05)
    sL = verts[selL][:,2].max()-verts[selL][:,2].min() if selL.any() else -1
    sR = verts[selR][:,2].max()-verts[selR][:,2].min() if selR.any() else -1
    return float(sL), float(sR)

for f in [0, 4, 6, 8, 10, 12, 14, 20]:
    sL, sR = eye_span_by_pos(f)
    print(f"frame {f:02d}: EyeL z-span={sL:.4f}  EyeR z-span={sR:.4f}")

# render open (0) vs closed (8) for the record
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

for f, name in [(0,"blink_open"), (8,"blink_closed")]:
    scene.frame_set(f)
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)
print("FINAL VERIFY DONE")