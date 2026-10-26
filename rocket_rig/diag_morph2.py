import bpy, os

OUT = r"C:\Users\24260\Desktop\教育agent\rocket_rig"

# tiny scene
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

# monkeypatch gather to dump settings
import importlib
mod = importlib.import_module("io_scene_gltf2.blender.exp.gather")
orig = mod.gather_gltf2
def patched(export_settings):
    with open(os.path.join(OUT, "settings_dump.txt"), "w") as fp:
        for k, v in sorted(export_settings.items()):
            try:
                if isinstance(v, (str, int, float, bool, type(None), list, tuple, dict)):
                    fp.write(f"{k} = {v}\n")
                else:
                    fp.write(f"{k} = <{type(v).__name__}>\n")
            except Exception:
                pass
    return orig(export_settings)
mod.gather_gltf2 = patched
# also patch gather_animations entry
mod2 = importlib.import_module("io_scene_gltf2.blender.exp.animation.animations")
orig_anim = mod2.gather_animations
def patched_anim(export_settings):
    with open(os.path.join(OUT, "anim_dump.txt"), "a") as fp:
        fp.write(f"gather_animations called; mode={export_settings.get('gltf_animation_mode')} morph_anim={export_settings.get('gltf_morph_anim')} morph={export_settings.get('gltf_morph')} apply={export_settings.get('gltf_apply')} anim={export_settings.get('gltf_animations')}\n")
    return orig_anim(export_settings)
mod2.gather_animations = patched_anim

dst = os.path.join(OUT, "test_morph2.glb")
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB",
                          export_apply=True, export_morph=True, export_morph_animation=True,
                          export_animation_mode="ACTIONS", export_image_format="NONE")
print("TINY2 DONE")