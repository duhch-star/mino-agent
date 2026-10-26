import json, struct, numpy as np

with open(r"C:\Users\24260\Desktop\教育agent\hi3d-rocket-mascot_1_rigged.glb","rb") as f:
    magic, version, length = struct.unpack("<III", f.read(12))
    chunks=[]
    while f.tell() < length:
        clen, ctype = struct.unpack("<II", f.read(8))
        chunks.append((ctype, f.read(clen)))
g = json.loads(chunks[0][1])
bin_ = [c[1] for c in chunks if c[0]==0x4E4942][0]

comp = {5126: np.float32, 5125: np.uint32, 5121: np.uint8}
comp_n = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def read_acc(i):
    acc = g["accessors"][i]
    bv = g["bufferViews"][acc["bufferView"]]
    dt = comp[acc["componentType"]]
    n = comp_n[acc["type"]]
    raw = bin_[bv["byteOffset"]: bv["byteOffset"]+bv.get("byteLength", acc["count"]*n*dt().nbytes)]
    arr = np.frombuffer(raw, dtype=dt, count=acc["count"]*n).reshape(-1, n)
    return arr

for a in g.get("animations", []):
    print("=== animation:", a.get("name"))
    for i, ch in enumerate(a["channels"]):
        s = a["samplers"][ch["sampler"]]
        times = read_acc(s["input"]).ravel()
        vals = read_acc(s["output"])
        tgt = ch["target"]
        node = g["nodes"][tgt["node"]].get("name", tgt["node"])
        print(f"  ch{i}: target node={node} path={tgt['path']} sampler={ch['sampler']} interpolation={s.get('interpolation')}")
        print(f"    times={np.round(times,1).tolist()}")
        if vals.shape[1] <= 4:
            print(f"    values={np.round(vals,4).tolist()}")
        else:
            print(f"    values shape={vals.shape} nonzero rows={int((np.abs(vals).max(axis=1)>1e-6).sum())}")