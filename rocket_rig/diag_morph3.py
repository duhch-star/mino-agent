import bpy, os, json

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1.0)
cube = bpy.context.object
key = cube.shape_key_add(name="Big")
basis = cube.data.shape_keys.key_blocks[0]
for i, v in enumerate(basis.data):
    key.data[i].co = (v.co[0]*1.5, v.co[1]*1.5, v.co[2])
sk2 = cube.data.shape_keys
sk2.animation_data_create()
a = bpy.data.actions.new("Grow")
sk2.animation_data.action = a
fcu = a.fcurve_ensure_for_datablock(sk2, 'key_blocks["Big"].value', index=0)
for i,(f,v) in enumerate([(0,0.0),(6,1.0),(12,1.0),(18,0.0)]):
    fcu.keyframe_points.add(1)
    fcu.keyframe_points[-1].co = (f,v)

import importlib
gather_mod = importlib.import_module("io_scene_gltf2.blender.exp.gather")
anim_mod = importlib.import_module("io_scene_gltf2.blender.exp.animation.animations")
orig_gather_anim = anim_mod.gather_animations

def patched_gather_anim(export_settings):
    log = {"mode": export_settings.get("gltf_animation_mode"),
           "morph_anim": export_settings.get("gltf_morph_anim"),
           "call_trace": "called"}
    try:
        results = orig_gather_anim(export_settings)
        if results is None:
            log["ret"] = None
        else:
            log["ret"] = [{"name": r.name, "channels": len(r.channels)} for r in results]
    except Exception as e:
        log["ret"] = "EXC " + repr(e)
    with open(os.path.join(OUT, "anim_dump2.json"), "w") as fp:
        json.dump(log, fp, indent=1)
    return results

gather_mod.gather_animations = patched_gather_anim

# also instrument primitive key block collection
prim_extract = importlib.import_module("io_scene_gltf2.blender.exp.primitive_extract")
orig_get_sk = None
from io_scene_gltf2.blender.com.data_path import get_sk_exported as orig_get_sk
def patched_get_sk(key_blocks):
    kb = [k.name for k in key_blocks]
    info = {"names": kb, "skip_flags": []}
    for k in key_blocks:
        flags = {"name": k.name, "is_first": key_blocks[0].name == k.name,
                 "relative_self": k == k.relative_key, "mute": k.mute}
        info["skip_flags"].append(flags)
    with open(os.path.join(OUT, "sk_dump.json"), "w") as fp:
        json.dump(info, fp, indent=1)
    return orig_get_sk(key_blocks)
import io_scene_gltf2.blender.com.data_path as dp_mod
dp_mod.get_sk_exported = patched_get_sk
# patch the two consumers as well
import io_scene_gltf2.blender.exp.primitives as prim_mod
prim_mod.get_sk_exported = patched_get_sk
import io_scene_gltf2.blender.exp.primitive_extract as pe_mod
pe_mod.get_sk_exported = patched_get_sk

dst = os.path.join(OUT, "test_morph3.glb")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                          export_apply=True, export_morph=True, export_morph_animation=True,
                          export_animation_mode="ACTIONS", export_image_format="NONE")
print("TINY3 DONE")