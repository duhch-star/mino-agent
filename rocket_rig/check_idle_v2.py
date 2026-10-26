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
    return np.frombuffer(raw, dtype=dt, count=acc["count"]*n).reshape(-1, n)

for a in g.get("animations", []):
    if a.get("name") != "Idle":
        continue
    # summarize: for each channel print node/path, sampler interp, count, and max deviation from neutral
    print("=== Idle")
    for i, ch in enumerate(a["channels"]):
        s = a["samplers"][ch["sampler"]]
        tgt = ch["target"]
        node = g["nodes"][tgt["node"]].get("name")
        times = read_acc(s["input"]).ravel()
        vals = read_acc(s["output"])
        span = float(np.ptp(vals, axis=0).max())
        print(f"  {node:6s} {tgt['path']:9s} interp={s.get('interpolation'):6s} n={len(times):3d} maxptp={span:.4f}")
    # sample Root Z and Chest/Head rotation at a few times
    def sample(node_name, path, t):
        for i, ch in enumerate(a["channels"]):
            tgt = ch["target"]
            if g["nodes"][tgt["node"]].get("name")==node_name and tgt["path"]==path:
                s = a["samplers"][ch["sampler"]]
                ts = read_acc(s["input"]).ravel(); vs = read_acc(s["output"])
                k = int(np.searchsorted(ts, t)); k = min(k, len(ts)-1)
                return vs[k].round(4).tolist()
        return None
    for t in (0, 1.5, 3.0):
        print(f"  t={t}: RootLoc={sample('Root','translation',t)} ChestQ={sample('Chest','rotation',t)} HeadQ={sample('Head','rotation',t)}")