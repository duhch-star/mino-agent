import json, struct, os

def dump(path, label):
    with open(path, "rb") as f:
        magic, version, length = struct.unpack("<III", f.read(12))
        chunks = []
        while f.tell() < length:
            clen, ctype = struct.unpack("<II", f.read(8))
            chunks.append((ctype, f.read(clen)))
    g = json.loads(chunks[0][1])
    print(f"===== {label} ===== size {os.path.getsize(path)}")
    print("accessors:")
    for i, acc in enumerate(g.get("accessors", [])):
        print(f"  {i}: type={acc.get('type')} comp={acc.get('componentType')} count={acc.get('count')} byteLen(bv)={g['bufferViews'][acc['bufferView']].get('byteLength') if acc.get('bufferView') is not None else 'SPARSE'}")
    print("meshes prims targets:", [ (m.get("name"), [p.get("targets") for p in m.get("primitives",[])]) for m in g.get("meshes",[])])
    print("anims:", [a["name"] for a in g.get("animations", [])])

dump(r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1.glb", "ORIGINAL")
dump(r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb", "RIGGED")