import bpy, math, json, os
import numpy as np

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 960

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
cam.location = (0, -1.6, 0)
target = bpy.data.objects.new("Target", None)
scene.collection.objects.link(target)
target.location = (0, 0, 0.1)
track = cam.constraints.new(type="TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

depsgraph = bpy.context.evaluated_depsgraph_get()
mx = cam.matrix_world
fwd = (-mx.col[2].xyz).normalized()
right = mx.col[0].xyz.normalized()
up = mx.col[1].xyz.normalized()
W, H = 960, 960
fov_x = cam.data.angle
fov_y = 2 * math.atan(math.tan(fov_x / 2) * (H / W))
print("fwd", fwd, "right", right, "up", up)

def ray_pixel(px, py):
    ndcx = 2 * px / (W - 1) - 1
    ndcy = 1 - 2 * py / (H - 1)
    d = fwd + ndcx * math.tan(fov_x / 2) * right + ndcy * math.tan(fov_y / 2) * up
    d.normalize()
    res_ = scene.ray_cast(depsgraph, cam.location, d, distance=10.0)
    ok, loc, nrm, idx, obj = res_[:5]
    return (loc.x, loc.y, loc.z) if ok else None

# blobs: name, list of (px,py) sample points (center + corners of bbox)
blobs = {
    "eyeL": [(424,430),(460,430),(424,482),(460,482),(442,456)],
    "eyeR": [(536,439),(572,439),(536,493),(572,493),(554,466)],
    "band_up": [(453,277),(594,277),(453,320),(594,320),(523,298)],
    "band_mid": [(412,342),(566,342),(412,399),(566,399),(489,370)],
    "col1": [(410,526),(440,526),(410,671),(440,671),(425,598)],
    "col2": [(449,525),(482,525),(449,672),(482,672),(466,598)],
    "col3": [(493,532),(528,532),(493,675),(528,675),(510,603)],
    "col4": [(534,527),(569,527),(534,675),(569,675),(553,601)],
}
res = {}
for name, pts in blobs.items():
    hits = []
    for px, py in pts:
        h = ray_pixel(px, py)
        if h:
            hits.append(h)
    if hits:
        arr = np.array(hits)
        res[name] = {"center": arr.mean(0).round(4).tolist(),
                     "mins": arr.min(0).round(4).tolist(),
                     "maxs": arr.max(0).round(4).tolist(),
                     "span": (arr.max(0)-arr.min(0)).round(4).tolist()}
    else:
        res[name] = None
    print(name, res[name])

with open(os.path.join(OUT, "blob_3d.json"), "w") as f:
    json.dump(res, f, indent=1)
print("RAYCAST DONE")