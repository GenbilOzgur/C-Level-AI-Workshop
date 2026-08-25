#!/usr/bin/env python3
"""Rebuilds rag_demo_data.js from top_rated_wines.csv.

Recipe (each choice is deliberate — changing it changes retrieval quality):
  * Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2, quantized ONNX.
    Multilingual so Turkish queries match English tasting notes.
  * Doc text = variety + region + notes. Wine NAMES are excluded on purpose:
    proper nouns dominate the embedding and wreck retrieval (measured: with
    names included, a fish/white-wine query returned red wines).
  * Vectors are centered on the corpus mean (hubness fix — without it a few
    "central" wines top every query), renormalized, then int8-quantized
    (max cosine loss measured at 0.00009).
  * PCA(2) over the centered space ships with the data so the page can
    project live queries into the same map.

Usage:  python3 -m venv env && env/bin/pip install onnxruntime tokenizers scikit-learn numpy
        env/bin/python rag_demo_build.py  (model files auto-download to ./model)
"""
import onnxruntime as ort, numpy as np, csv, json, base64, os, urllib.request
from tokenizers import Tokenizer
from sklearn.decomposition import PCA

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "model")
BASE = "https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/main"
os.makedirs(MODEL_DIR, exist_ok=True)
for name, url in [("tokenizer.json", f"{BASE}/tokenizer.json"),
                  ("model_quantized.onnx", f"{BASE}/onnx/model_quantized.onnx")]:
    p = os.path.join(MODEL_DIR, name)
    if not os.path.exists(p):
        print("indiriliyor:", name); urllib.request.urlretrieve(url, p)

tok = Tokenizer.from_file(os.path.join(MODEL_DIR, "tokenizer.json"))
tok.enable_truncation(max_length=128)
sess = ort.InferenceSession(os.path.join(MODEL_DIR, "model_quantized.onnx"))

def embed(texts, bs=32):
    out = []
    for i in range(0, len(texts), bs):
        encs = [tok.encode(t) for t in texts[i:i+bs]]
        L = max(len(e.ids) for e in encs)
        ids = np.array([e.ids + [1]*(L-len(e.ids)) for e in encs], dtype=np.int64)
        am  = np.array([[1]*len(e.ids) + [0]*(L-len(e.ids)) for e in encs], dtype=np.int64)
        o = sess.run(None, {"input_ids": ids, "attention_mask": am,
                            "token_type_ids": np.zeros_like(ids)})[0]
        m = am[..., None].astype(np.float32)
        e = (o*m).sum(1)/m.sum(1)
        out.append(e/np.linalg.norm(e, axis=1, keepdims=True))
    return np.vstack(out)

rows = list(csv.DictReader(open(os.path.join(HERE, "top_rated_wines.csv"), encoding="utf-8", errors="replace")))
docs = [f"{r['variety']} from {r['region']}. {r['notes'].strip()}" for r in rows]
Draw = embed(docs); MEAN = Draw.mean(0)
D = Draw - MEAN; D /= np.linalg.norm(D, axis=1, keepdims=True)

# Word map. Single-fruit names (cherry/vişne, citrus/narenciye, apple/elma,
# peach/şeftali) are excluded: their TR-EN alignment is weak in this model and
# they scatter in the 2-D projection (measured 27-59% of the map diagonal).
WORDS = [("spicy","tat"),("baharatlı","tat"),("sweet","tat"),("tatlı","tat"),("dry","tat"),("sek","tat"),
 ("fruity","meyve"),("meyveli","meyve"),
 ("oak","fıçı"),("meşe","fıçı"),("barrel","fıçı"),("fıçı","fıçı"),("vanilla","fıçı"),("vanilya","fıçı"),
 ("tannin","doku"),("tanen","doku"),("smooth","doku"),("yumuşak","doku"),("crisp","doku"),("taze","doku"),
 ("elegant","doku"),("zarif","doku"),
 ("fish","yemek"),("balık","yemek"),("steak","yemek"),("biftek","yemek"),("cheese","yemek"),("peynir","yemek"),
 ("celebration","bağlam"),("kutlama","bağlam"),("summer","bağlam"),("yaz","bağlam"),
 ("bank","tuzak"),("banka","tuzak"),("computer","tuzak"),("bilgisayar","tuzak")]
Wraw = embed([w for w,_ in WORDS]); Ww = PCA(2).fit_transform(Wraw)

QUERIES = ["balık yemeğinin yanına hafif, taze bir beyaz şarap",
 "meşe fıçıda dinlenmiş, yoğun tanenli güçlü bir kırmızı",
 "İzmir'den baharatlı bir şarap",
 "özel bir kutlama için prestijli, zarif bir şişe",
 "tatlı ve meyveli, akşamüstü içimlik bir şarap",
 "a fresh white wine with citrus and mineral notes"]
Qraw = embed(QUERIES); Qc = Qraw - MEAN; Qc /= np.linalg.norm(Qc, axis=1, keepdims=True)
pca = PCA(2).fit(D); D2 = pca.transform(D); Q2 = pca.transform(Qc)
scale = float(np.abs(D).max()/127.0)
D8 = np.clip(np.round(D/scale), -127, 127).astype(np.int8)

data = {"dim": 384, "scale": scale, "mean": [round(float(v),5) for v in MEAN],
 "vectors_b64": base64.b64encode(D8.tobytes()).decode(),
 "wines": [{"n": r["name"], "r": r["region"], "v": r["variety"], "s": r["rating"],
            "t": r["notes"].strip()[:600],
            "x": round(float(x),2), "y": round(float(y),2)} for r,(x,y) in zip(rows, D2)],
 "words": [{"w": w, "c": c, "x": round(float(x),2), "y": round(float(y),2)}
           for (w,c),(x,y) in zip(WORDS, Ww)],
 "queries": [{"q": q, "vec": [round(float(v),4) for v in vec],
              "x": round(float(x),2), "y": round(float(y),2)}
             for q,vec,(x,y) in zip(QUERIES, Qc, Q2)],
 "pca": {"comps": [[round(float(v),5) for v in row] for row in pca.components_]}}
out = os.path.join(HERE, "rag_demo_data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("// Auto-generated by rag_demo_build.py — see that file for the recipe.\n")
    f.write("window.RAG_DATA=")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("yazıldı:", out, os.path.getsize(out)//1024, "KB")
