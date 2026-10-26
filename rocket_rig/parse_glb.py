import json, struct

GLB = r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb"
with open(GLB, "rb") as f:
    magic, version, length = struct.unpack("<III", f.read(12))
    assert magic == 0x46546C67, hex(magic)
    chunks = []
    while f.tell() < length:
        clen, ctype = struct.unpack("<II", f.read(8))
        chunks.append((ctype, f.read(clen)))
json_chunk = [c for c in chunks if c[0] == 0x4E4F534A][0]
g = json.loads(json_chunk[1])
print("version", version, "chunks", [(hex(c[0]), len(c[1])) for c in chunks])

print("\n== nodes with skins/children ==")
for i, n in enumerate(g.get("nodes", [])):
    if "skin" in n or "mesh" in n or "children" in n:
        print(i, {k: v for k, v in n.items() if k != "children"}, "children:", n.get("children"))

print("\n== meshes ==")
for m in g.get("meshes", []):
    for p in m.get("primitives", []):
        print("mesh", m["name"], "prims:", {k: p.get(k) for k in ("attributes", "targets", "material", "mode")})

print("\n== skins ==")
print(json.dumps(g.get("skins", []), indent=1)[:1500])

print("\n== animations ==")
for a in g.get("animations", []):
    print("anim:", a["name"])
    for ch in a.get("channels", []):
        print("   channel target:", ch.get("target"))

print("\n== images ==")
for im in g.get("images", []):
    print(im)

import os
print("file size MB:", round(os.path.getsize(GLB)/1e6, 2))