import json, struct
with open(r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb","rb") as f:
    magic, version, length = struct.unpack("<III", f.read(12))
    chunks=[]
    while f.tell() < length:
        clen, ctype = struct.unpack("<II", f.read(8))
        chunks.append((ctype, f.read(clen)))
g = json.loads(chunks[0][1])
print("=== bufferViews ===")
for i, bv in enumerate(g.get("bufferViews", [])):
    bl = bv.get("byteLength", 0)
    kind = ""
    for ti, t in enumerate(g.get("textures", [])):
        if t.get("source") == i: kind = f"TEXTURE source of texture {ti}"
    for ii, im in enumerate(g.get("images", [])):
        if im.get("bufferView") == i: kind = f"IMAGE {im.get('name')}"
    for ai, acc in enumerate(g.get("accessors", [])):
        if acc.get("bufferView") == i: kind += f" | accessor {ai} {acc.get('type')}"
    print(i, bl, kind)
print("=== total ===", sum(bv.get("byteLength",0) for bv in g.get("bufferViews", [])))
