import json, struct, numpy as np

def load_glb(path):
    with open(path, "rb") as f:
        magic, version, length = struct.unpack("<III", f.read(12))
        chunks = []
        while f.tell() < length:
            clen, ctype = struct.unpack("<II", f.read(8))
            chunks.append((ctype, f.read(clen)))
    return json.loads(chunks[0][1]), {c[0]: c[1] for c in chunks}

g, ch = load_glb(r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb")
bin_ = ch[0x4E4942]

comp_gltf = {5126: np.float32, 5125: np.uint32, 5121: np.uint8}
comp_sz = {5126: 4, 5125: 4, 5121: 1}

def read_accessor(idx):
    acc = g["accessors"][idx]
    if "sparse" in acc:
        sp = acc["sparse"]
        count = sp["count"]
        base = np.zeros((count, ), dtype=np.float32)  # placeholder
        # read base via bufferView (may be omitted? sparse requires base bufferView)
        base = read_plain(acc)
        si = sp["indices"]
        sv = sp["values"]
        iarr = np.frombuffer(bin_, dtype=comp_gltf[si["componentType"]], count=count, offset=si["bufferView"]["byteOffset"] + g["bufferViews"][si["bufferView"]["index"]]["byteOffset"])
        # values: componentType per values
        vtype = sv.get("componentType", comp_gltf[acc["componentType"]]) if isinstance(sv, dict) else None
        varr = np.frombuffer(bin_, dtype=comp_gltf[acc["componentType"]], count=count * 3, offset=sv["bufferView"]["byteOffset"] + g["bufferViews"][sv["bufferView"]["index"]]["byteOffset"])
        varr = varr.reshape(-1, 3)
        out = base.copy()
        out[iarr] += varr
        return out
    return read_plain(acc)

def read_plain(acc):
    bv = g["bufferViews"][acc["bufferView"]]
    dt = comp_gltf[acc["componentType"]]
    n = acc["count"]
    stride = bv.get("byteStride", dt().nbytes * ({'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc["type"]]))
    raw = bin_[bv["byteOffset"]: bv["byteOffset"] + bv.get("byteLength", stride*n)]
    arr = np.frombuffer(raw, dtype=dt, count=n * ({'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc["type"]]))
    return arr.reshape(-1, {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc["type"]])

# accessor 6 = morph POSITION (from parse: targets [{'POSITION':6,'NORMAL':7}])
for idx in (6, 7):
    acc = g["accessors"][idx]
    if "sparse" in acc:
        sp = acc["sparse"]
        print(f"accessor {idx}: type={acc['type']} count={acc['count']} SPARSE count={sp['count']} "
              f"indicesBV={sp['indices']['bufferView']} valuesBV={sp['values']['bufferView']}")
        # read sparse deltas directly (skip base)
        si = sp["indices"]; sv = sp["values"]
        bvi = g["bufferViews"][si["bufferView"]]
        bvv = g["bufferViews"][sv["bufferView"]]
        iarr = np.frombuffer(bin_, dtype=comp_gltf[si["componentType"]], count=sp["count"], offset=bvi["byteOffset"])
        varr = np.frombuffer(bin_, dtype=comp_gltf[sv.get("componentType", 5126)], count=sp["count"]*3, offset=bvv["byteOffset"]).reshape(-1,3)
        nz = np.abs(varr).max(axis=1)
        print(f"  sparse count={len(iarr)} max|delta|={np.abs(varr).max():.5f}  verts with |d|>1e-4: {(nz>1e-4).sum()}")
        if len(iarr) <= 80:
            print("  first indices:", iarr[:min(40,len(iarr))].tolist())
            print("  sample deltas:", varr[:min(8,len(varr))].round(5).tolist())
    else:
        print(f"accessor {idx}: dense")
        arr = read_plain(acc)
        print("  max abs:", np.abs(arr).max())