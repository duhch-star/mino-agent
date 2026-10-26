import json, struct
with open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\test_morph.glb","rb") as f:
    magic, version, length = struct.unpack("<III", f.read(12))
    chunks=[]
    while f.tell() < length:
        clen, ctype = struct.unpack("<II", f.read(8))
        chunks.append((ctype, f.read(clen)))
g = json.loads(chunks[0][1])
print("meshes:", json.dumps(g.get("meshes"), indent=1))
print("anims:", [(a["name"], [ (c["target"]["path"]) for c in a["channels"]]) for a in g.get("animations",[])])
