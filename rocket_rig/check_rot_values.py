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
    for i, ch in enumerate(a["channels"]):
        s = a["samplers"][ch["sampler"]]
        tgt = ch["target"]
        node = g["nodes"][tgt["node"]].get("name")
        if tgt["path"] != "rotation" or node not in ("Chest", "Head"):
            continue
        times = read_acc(s["input"]).ravel()
        vals = read_acc(s["output"])
        # print only every 3rd sample for brevity: find max deviation from identity quaternion
        qid = np.array([0,0,0,1.0], dtype=np.float32)
        dev = np.abs(vals - qid).max(axis=1)
        print(f"{node} rotation: n={len(times)} samples, max dev from identity = {dev.max():.4f}")
        for k in range(0, len(times), 7):
            print(f"   t={times[k]:.2f} q=({vals[k,0]:.4f},{vals[k,1]:.4f},{vals[k,2]:.4f},{vals[k,3]:.4f})")