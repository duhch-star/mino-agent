import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1.0)
o = bpy.context.object
k1 = o.shape_key_add(name="Basis")
print("after add Basis:", [k.name for k in o.data.shape_keys.key_blocks], "rel of each:", [(k.name, k.relative_key.name) for k in o.data.shape_keys.key_blocks])
k2 = o.shape_key_add(name="Blink")
print("after add Blink:", [(k.name, k.relative_key.name) for k in o.data.shape_keys.key_blocks])
k2.relative_key = o.data.shape_keys.key_blocks["Basis"]
print("after set rel:", [(k.name, k.relative_key.name) for k in o.data.shape_keys.key_blocks])
# check a delta is stored correctly
basis = o.data.shape_keys.key_blocks["Basis"]
for i, v in enumerate(basis.data):
    k2.data[i].co = (v.co[0]*1.5, v.co[1], v.co[2])
k2.value = 1.0
dg = bpy.context.evaluated_depsgraph_get()
ev = o.evaluated_get(dg)
print("evaluated max co:", [round(x,2) for x in max(ev.data.vertices, key=lambda vv: vv.co.x).co])
