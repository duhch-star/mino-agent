import bpy, math, json, os, time
import numpy as np

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"
SRC = r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb"
DST = r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb"
BLEND = r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.blend"

t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")
mesh = mesh_obj.data
n = len(mesh.vertices)
verts = np.zeros((n, 3), dtype=np.float32)
mesh.vertices.foreach_get("co", verts.ravel())
print("mesh", mesh_obj.name, "verts", n)

# ============ A. blink shape key (eyes from json) — v3: clean pure squash, no inward ============
with open(os.path.join(OUT, "eyes.json")) as f:
    eyes = json.load(f)

basis_key = mesh_obj.shape_key_add(name="Basis")
blink_key = mesh_obj.shape_key_add(name="Blink")
blink_key.relative_key = basis_key
basis = mesh_obj.data.shape_keys.key_blocks["Basis"]
deltas = np.zeros((n, 3), dtype=np.float32)

# Pure z-squash around eye center c (vertical axis Z, face -Y).
# core: squash to 0.02 of half-extent (near line). transition ring: 0.035..0.075 tight falloff.
for name, info in eyes.items():
    c = np.array(info["center"]); zc = c[2]
    for tag, zf, r0, r1 in (("core", 0.02, 0.0, 0.035), ("ring", 1.0, 0.035, 0.075)):
        idx = np.array(info[tag], dtype=np.int64)
        if len(idx) == 0:
            continue
        rv = verts[idx].copy()
        dx = np.abs(rv[:, 0] - c[0]); dz = np.abs(rv[:, 2] - zc)
        r = np.sqrt(dx**2 + dz**2)
        if tag == "core":
            fall = (1.0 - zf) * np.ones_like(r)
        else:
            t = np.clip((r - r0) / (r1 - r0), 0.0, 1.0)
            fall = (1.0 - t*t*(3-2*t)) * 0.96
        rv[:, 2] = zc + (rv[:, 2] - zc) * (1.0 - fall)
        deltas[idx] = rv - verts[idx]
aff = np.where(np.abs(deltas).max(axis=1) > 1e-6)[0]
for i in aff:
    co = basis.data[i].co.copy()
    for j in range(3):
        co[j] += deltas[i][j]
    blink_key.data[i].co = co
print("blink shape key affected verts:", len(aff))
blink_key.value = 0.0

# ============ B. armature ============
BONES = [
    ("Root",  (0, 0, -0.46), (0, 0, -0.22)),
    ("Spine", (0, 0, -0.22), (0, 0, 0.00)),
    ("Chest", (0, 0, 0.00),  (0, 0, 0.16)),
    ("Neck",  (0, 0, 0.16),  (0, 0, 0.26)),
    ("Head",  (0, 0, 0.26),  (0, 0, 0.45)),
]
arm_data = bpy.data.armatures.new("RocketRig")
arm_obj = bpy.data.objects.new("RocketRig", arm_data)
scene.collection.objects.link(arm_obj)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode="EDIT")
prev = None
for name, head, tail in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head = head
    eb.tail = tail
    if prev is not None:
        eb.parent = prev
        eb.use_connect = True
    prev = eb
bpy.ops.object.mode_set(mode="OBJECT")
print("armature bones:", [b.name for b in arm_data.bones])

# ============ C. smooth distance weights (quantized bulk writes) ============
heads = np.array([b.head for b in arm_data.bones], dtype=np.float32)
tails = np.array([b.tail for b in arm_data.bones], dtype=np.float32)
dd = tails - heads
lens2 = np.einsum("ij,ij->i", dd, dd)
nb = len(BONES)
D = np.zeros((n, nb), dtype=np.float32)
for bi in range(nb):
    tv = np.clip(np.einsum("ij,j->i", verts - heads[bi], dd[bi]) / max(lens2[bi], 1e-9), 0, 1)
    p = heads[bi] + tv[:, None] * dd[bi]
    D[:, bi] = np.linalg.norm(verts - p, axis=1)
sigma = 0.11
Wm = np.exp(-(D / sigma) ** 2)
near = D < 0.30
far = ~near.any(axis=1)
Wm[far] = 0.0
Wm[far, np.argmin(D[far], axis=1)] = 1.0
s = Wm.sum(axis=1, keepdims=True); s[s < 1e-8] = 1.0
Wm = Wm / s
Wm[Wm < 0.02] = 0.0
s2 = Wm.sum(axis=1, keepdims=True); s2[s2 < 1e-8] = 1.0
Wm = Wm / s2

for name, _, _ in BONES:
    mesh_obj.vertex_groups.new(name=name)

CH = 8192
for bi, (name, _, _) in enumerate(BONES):
    vg = mesh_obj.vertex_groups[name]
    col = Wm[:, bi]
    idxs = np.where(col > 0.01)[0]
    if len(idxs) == 0:
        continue
    ws = col[idxs]
    qs = np.unique(np.round(ws * 100) / 100)
    for q in qs:
        qi = idxs[np.abs(ws - q) < 5e-4]
        for k in range(0, len(qi), CH):
            vg.add(qi[k:k+CH].tolist(), float(q), "REPLACE")
    print("group", name, "verts", len(idxs))
print("weights built")

# ============ D. parent & skin ============
mesh_obj.parent = arm_obj
mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
mod.object = arm_obj

# ============ E. animations ============
scene.render.fps = 30

# --- Blink (shape key) — natural blink: quick close, short hold, slow open ---
sk = mesh_obj.data.shape_keys
sk.animation_data_create()
act_blink = bpy.data.actions.new("Blink")
sk.animation_data.action = act_blink
fcu = act_blink.fcurve_ensure_for_datablock(sk, 'key_blocks["Blink"].value', index=0)
# 30fps timeline. 0-4 quick close, 4-6 hold closed, 6-14 slow open, 14-26 stay open.
frm = [(0,0.0),(1,0.05),(2,0.45),(3,0.9),(4,1.0),(6,1.0),(8,0.75),(10,0.4),(12,0.12),(14,0.0),(26,0.0)]
fcu.keyframe_points.add(len(frm))
for i,(f,v) in enumerate(frm):
    fcu.keyframe_points[i].co = (f, v)
    fcu.keyframe_points[i].interpolation = "BEZIER"

# --- Idle (bones): 120 frames = 4s loop, organic multi-channel motion ---
arm_anim = arm_obj.animation_data_create()
act_idle = bpy.data.actions.new("Idle")
arm_anim.action = act_idle

def add_fcu(path, idx, fv):
    fcu = act_idle.fcurve_ensure_for_datablock(arm_obj, path, index=idx)
    fcu.keyframe_points.add(len(fv))
    for i,(f,v) in enumerate(fv):
        fcu.keyframe_points[i].co = (f, v)
        fcu.keyframe_points[i].interpolation = "BEZIER"

# Root: subtle sway X + breath bob Z (asymmetric, phase-offset), Y fixed
add_fcu('pose.bones["Root"].location', 0, [(0,0.0),(30,0.004),(60,0.0),(90,-0.004),(120,0.0)])
add_fcu('pose.bones["Root"].location', 1, [(0,0.0),(40,0.002),(80,-0.002),(120,0.0)])
add_fcu('pose.bones["Root"].location', 2, [(0,0.0),(22,0.011),(48,0.002),(70,-0.007),(95,0.0),(120,0.0)])
# Chest: sway Z, breathe pitch X, slight turn Y — all different periods
from mathutils import Euler, Quaternion

def add_quat_fcu(bone, axes_curves):
    # axes_curves: list of (axis_index, [(frame, angle)]) ; axis 0=x,1=y,2=z
    arm_obj.pose.bones[bone].rotation_mode = "QUATERNION"
    n = max(len(c) for _, c in axes_curves)
    frames = sorted({f for _, c in axes_curves for f, _ in c})
    pts = {}
    for f in frames:
        e = [0.0, 0.0, 0.0]
        for axis, curve in axes_curves:
            # linear interp of keyframe angles at frame f
            ks = curve
            if f <= ks[0][0]:
                e[axis] = ks[0][1]
            elif f >= ks[-1][0]:
                e[axis] = ks[-1][1]
            else:
                for (f0, a0), (f1, a1) in zip(ks, ks[1:]):
                    if f0 <= f <= f1:
                        t = (f - f0) / (f1 - f0)
                        # smoothstep between keyframes for organic feel
                        t = t * t * (3 - 2 * t)
                        e[axis] = a0 + (a1 - a0) * t
                        break
        q = Euler(e, "XYZ").to_quaternion()
        pts[f] = (q.w, q.x, q.y, q.z)
    for idx in (0, 1, 2, 3):
        fv = [(f, v[idx]) for f, v in pts.items()]
        fcu = act_idle.fcurve_ensure_for_datablock(arm_obj, 'pose.bones["%s"].rotation_quaternion' % bone, index=idx)
        fcu.keyframe_points.add(len(fv))
        for i, (f, v) in enumerate(fv):
            fcu.keyframe_points[i].co = (f, v)
            fcu.keyframe_points[i].interpolation = "BEZIER"

# Chest: Z sway ±0.022 (60f period), X breathe ±0.009 (120f), Y micro-turn ±0.010 (120f, phase-offset)
add_quat_fcu("Chest", [
    (0, [(0,-0.022),(30,0.022),(60,-0.022),(90,0.022),(120,-0.022)]),
    (1, [(0,0.0),(60,-0.009),(120,0.0)]),
    (2, [(0,-0.010),(40,0.010),(80,-0.010),(120,-0.010)]),
])
# Head: X nod asymmetric (30f), Z tilt ±0.010 (80f), Y glance ±0.012 (60f) — all offset from Chest
add_quat_fcu("Head", [
    (0, [(0,0.024),(15,-0.014),(30,0.010),(45,-0.014),(60,0.024),(90,-0.010),(120,0.024)]),
    (1, [(0,0.0),(60,0.012),(120,0.0)]),
    (2, [(0,-0.010),(40,0.006),(80,-0.006),(120,-0.010)]),
])
print("actions:", [a.name for a in bpy.data.actions])

# ============ F. save blend (with modifier for editing) ============
bpy.ops.wm.save_as_mainfile(filepath=BLEND)

# ============ G. export GLB (keep modifier so the exporter emits skin; Draco shrinks the per-loop geometry) ============
bpy.ops.export_scene.gltf(
    filepath=DST, export_format="GLB",
    export_apply=False,
    export_morph=True,
    export_morph_animation=True,
    export_morph_normal=True,
    export_image_format="WEBP",
    export_image_quality=92,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_draco_mesh_compression_enable=True,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_draco_generic_quantization=12,
)
print("EXPORT DONE in", round(time.time()-t0, 1), "s")