"""Exports the tier-1 candidate NER models to ONNX the way transformers.js loads them.

For each key: download a pinned revision (only the files an export needs), load the
token-classification weights into a stock transformers class (never trust_remote_code),
export fp32 ONNX at opset 14, check PyTorch vs ONNX logits on invented sentences, then
quantize to int8 with the recipe of the shipped onnx-community q8 file (EXPORTS.md).

  py -3 bench/model-eval/export.py download [key ...]   fetch pinned files only
  py -3 bench/model-eval/export.py recipe-check          re-export dictabert-ner, compare with shipped q8
  py -3 bench/model-eval/export.py export [key ...]      export, verify, quantize, lay out
  py -3 bench/model-eval/export.py agreement [key ...]   q8 vs its own fp32 labels on bench/corpus
  py -3 bench/model-eval/export.py registry              write registry.exports.json from the exports

Outputs go to C:/Users/Me/.vscode/paintItBlack/model-cache/<key>/, never into the repo.
The corpus texts are read only to count label agreement; no text is printed.
"""
import hashlib
import json
import os
import sys
import time
from pathlib import Path

# xet transfers stalled at 0 bytes on this machine (2026-09-23); plain HTTP works. Set before
# huggingface_hub is imported, which happens lazily inside fetch().
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CACHE = REPO.parent / "model-cache"
SHIPPED_Q8 = REPO / "node_modules/@huggingface/transformers/.cache/onnx-community/dictabert-ner-ONNX/onnx/model_quantized.onnx"
OPSET = 14
MAX_DIFF = 1e-3

# Revisions pinned 2026-09-23 from the hub. "head" names the NER head inside a multi-head
# checkpoint (joint/parse): only bert.* and that head are loaded. In BertForJointParsing the
# NER head is self.classifier applied to dropout(bert(...)[0]), the stock token-classification
# path (read from its source, never run); the cls/morph/prefix/syntax heads are dropped.
MODELS = {
    "recipe-base": dict(repo="dicta-il/dictabert-ner", revision="05ed61bc99437b13bc2bdef8154c52f8b44eaad6",
                        arch="bert", licence="CC-BY-4.0", trainedOn=["unknown"], tier=0,
                        notes="recipe check only: today's model re-exported"),
    # trainedOn follows the model cards; where a card is silent the plan's research notes say
    # so in notes, so a contamination table can tell a stated source from an inferred one
    "joint-base": dict(repo="dicta-il/dictabert-joint", revision="3c3c27067bb73a45e99c36bd90b3b3dbc10fda12",
                       arch="bert", head="classifier", licence="CC-BY-4.0", trainedOn=["NEMO", "IAHLT NER", "IAHLT UD"],
                       notes="the card names no NER data; NEMO plus IAHLT is from the DictaBERT-joint paper"),
    "parse-base": dict(repo="dicta-il/dictabert-parse", revision="37f4d6fd556766f15e955fe5bd0f16942b46853e",
                       arch="bert", head="classifier", licence="CC-BY-4.0", trainedOn=["NEMO", "Hebrew UD", "dictabert-joint"],
                       notes="card: initialized from dictabert-joint, tuned on the Hebrew UD Treebank and NEMO"),
    "tiny-parse": dict(repo="dicta-il/dictabert-tiny-parse", revision="8e97fcdcec347e1ef1b24d82c01d4fc73989ece8",
                       arch="bert", head="classifier", licence="CC-BY-4.0", trainedOn=["NEMO", "Hebrew UD", "dictabert-tiny-joint"],
                       notes="card: initialized from dictabert-tiny-joint, tuned on the Hebrew UD Treebank and NEMO"),
    "iahlt-base": dict(repo="iahlt/ner-baseline-dictabert-he", revision="835ee823e4425639a4ee881382fad87e294d0974",
                       arch="bert", licence="CC-BY-4.0", trainedOn=["IAHLT NER"],
                       notes="labels are bare type names (IO without an I- prefix)"),
    "msperka-dicta": dict(repo="msperka/dictabert_ner", revision="db09fbb80715f42876f8f4814d48765d96c87b42",
                          arch="bert", licence="CC-BY-4.0", trainedOn=["NEMO"]),
    "aleph": dict(repo="msperka/aleph_bert-finetuned-ner", revision="aa98849ee5c29139c1d96532502ed152bb72f831",
                  arch="bert", licence="Apache-2.0", trainedOn=["NEMO"]),
    "golem": dict(repo="CordwainerSmith/GolemPII-v1", revision="5f2324a261001f1ca4f7f97bcabf2303a58487cd",
                  arch="xlm-roberta", licence="MIT", trainedOn=["GolemGuard (synthetic)"],
                  notes="the card asks for a citation line; FIRST_NAME/LAST_NAME are separate types"),
    "large-q8": dict(repo="dicta-il/dictabert-large-ner", revision="ac70130828d5a6811c2dc451e2255424c96f0eb0",
                     arch="bert", licence="CC-BY-4.0", trainedOn=["unknown"]),
}
EXPORT_ORDER = ["tiny-parse", "iahlt-base", "msperka-dicta", "aleph", "joint-base", "parse-base", "golem", "large-q8"]
SHIPPABLE = {"CC-BY-4.0", "Apache-2.0", "MIT"}

# Top-level files only: no optimizer.pt, scheduler.pt, checkpoint-*, runs/, training_args.bin
# (a pickle), and no custom modelling .py (we never run remote code).
WANT = ["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json",
        "special_tokens_map.json", "vocab.txt", "sentencepiece.bpe.model", "README.md"]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def fetch(key):
    """Returns the local snapshot folder of the pinned revision, downloading what is missing."""
    from huggingface_hub import HfApi, snapshot_download
    m = MODELS[key]
    names = {s.rfilename for s in HfApi().model_info(m["repo"], revision=m["revision"]).siblings}
    allow = [n for n in WANT if n in names]
    if "model.safetensors" not in allow:
        # no safetensors: fall back to the .bin, which load_weights opens with weights_only=True
        allow.append("pytorch_model.bin")
    log("fetch", key, m["repo"], m["revision"][:7], allow)
    return Path(snapshot_download(m["repo"], revision=m["revision"], allow_patterns=allow))


def cmd_download(keys):
    for k in keys or list(MODELS):
        fetch(k)
        log("have", k)


# ---------------------------------------------------------------- loading

def load_weights(snap):
    """State dict from safetensors, or from a .bin opened with weights_only=True (no pickle code runs)."""
    import torch
    st = snap / "model.safetensors"
    if st.exists():
        from safetensors.torch import load_file
        return load_file(str(st))
    return torch.load(str(snap / "pytorch_model.bin"), map_location="cpu", weights_only=True)


def head_prefix(sd, key, num_labels):
    """The NER head's key prefix inside a multi-head checkpoint: the one module outside bert.*
    whose weight has num_labels rows. Refuses to guess when there is not exactly one."""
    m = MODELS[key]
    want = m.get("head")
    cands = sorted({k[: -len("weight")] for k, v in sd.items()
                    if k.endswith("weight") and not k.startswith("bert.") and v.ndim == 2 and v.shape[0] == num_labels})
    named = [c for c in cands if c.split(".")[0] == want]
    if len(named) != 1:
        raise SystemExit(f"{key}: cannot pick one NER head among {cands}")
    return named[0]


def build_model(key, snap):
    """A stock *ForTokenClassification with every weight filled from the checkpoint.
    Returns (model, config dict for the export, report)."""
    import torch
    from transformers import AutoConfig, BertForTokenClassification, XLMRobertaForTokenClassification
    m = MODELS[key]
    raw = json.loads((snap / "config.json").read_text("utf8"))
    # a config with auto_map is only read as data here; its code is never fetched or run
    cfg = AutoConfig.from_pretrained(str(snap), trust_remote_code=False)
    cfg._attn_implementation = "eager"  # plain Softmax attention, the graph shape of the shipped file
    cls = XLMRobertaForTokenClassification if m["arch"] == "xlm-roberta" else BertForTokenClassification
    sd = load_weights(snap)
    rep = {"checkpointKeys": len(sd)}
    if m.get("head"):
        pre = head_prefix(sd, key, cfg.num_labels)
        rep["headPrefix"] = pre
        mapped = {k: v for k, v in sd.items() if k.startswith("bert.")}
        for k, v in sd.items():
            if k.startswith(pre):
                mapped["classifier." + k[len(pre):]] = v
        rep["droppedHeads"] = sorted({k.split(".")[0] for k in sd if not k.startswith("bert.") and not k.startswith(pre)})
        # the joint checkpoints carry task flags and a custom architecture: keep only what a stock BERT reads
        cfg.architectures = ["BertForTokenClassification"]
        for f in ("auto_map", "do_lex", "do_morph", "do_ner", "do_prefix", "do_syntax", "syntax_head_size", "newmodern"):
            if hasattr(cfg, f):
                delattr(cfg, f)
        sd = mapped
    model = cls(cfg)
    model.eval()
    res = model.load_state_dict(sd, strict=False)
    missing, unexpected = load_problems(res.missing_keys, res.unexpected_keys)
    rep["missing"], rep["unexpected"] = missing, unexpected
    if missing:
        raise SystemExit(f"{key}: missing keys {missing[:10]}")
    if unexpected:
        # multi-head too: after the head is picked only bert.* and classifier.* remain, so a leftover
        # here is a bert.* weight the stock class does not have, which strict=False would drop silently
        raise SystemExit(f"{key}: unexpected keys {unexpected[:10]}")
    rep["rawArchitectures"] = raw.get("architectures")
    return model, cfg, rep


def load_problems(missing_keys, unexpected_keys):
    """position_ids is a buffer some checkpoints save and some do not; every other key must match."""
    keep = lambda ks: [k for k in ks if not k.endswith("position_ids")]
    return keep(missing_keys), keep(unexpected_keys)


# ---------------------------------------------------------------- export and checks

# Invented sentences (no real people), a mix of registers the product sees: court, meeting,
# letter, spoken, with names, places, bodies, numbers, a prefix letter and one with nikud.
SENTENCES = [
    "עו\"ד דניאל כהן הגיש את הבקשה לבית המשפט המחוזי בחיפה ביום שלישי.",
    "בישיבה השתתפו רונית לוי, אבי מזרחי ויעל ברק מחברת אורן תעשיות בע\"מ.",
    "המבקשת, גב' שירה אלמוג, מתגוררת ברחוב הזית 12 בקריית גת.",
    "לדברי מר יוסי אבוטבול, הפגישה עם עיריית נתניה נדחתה לחודש הבא.",
    "התובע טוען כי חברת גלבוע אחזקות הפרה את ההסכם שנחתם בתל אביב.",
    "ד\"ר מרים חדד מבית החולים סורוקה העידה בפני הוועדה.",
    "אני אמרתי לנועה שאנחנו ניפגש בבאר שבע ביום ראשון.",
    "הנתבע, משה פרידמן, עבד במשרד הבריאות בין השנים 2015 ל-2019.",
    "ההחלטה נשלחה לעו\"ד תמר גולדשטיין ולבא כוחה של המדינה.",
    "סמיר חורי ואחמד נסאר הגיעו מנצרת לדיון בבית הדין לעבודה.",
    "הבנק הודיע לאילנה שפירא כי החשבון בסניף רמת גן ייסגר.",
    "בפרוטוקול נרשם כי חבר הכנסת עמית רוזן הצביע נגד ההצעה.",
    "שָׁלוֹם לְאוֹרִי וּלְמִיכַל מִירוּשָׁלַיִם.",
    "המכתב נשלח אל גלעד ששון, רחוב הרצל 5, ראשון לציון.",
    "ביום 3.4.2021 נפגשה הוועדה עם נציגי אגודת השחייה של אשדוד.",
    "כשהגעתי לדנה היא כבר דיברה עם השכן מהקומה השלישית.",
    "חברת מגדל שירותים פיננסיים ערערה לבית המשפט העליון בירושלים.",
    "העדה ליאת בן דוד מסרה כי ראתה את הנאשם ליד תחנת הדלק בחדרה.",
    "Daniel Katz from Haifa signed on behalf of Orion Systems Ltd.",
    "בסוף הדיון ביקש השופט אהרון ויס לקבל את הסיכומים עד יום חמישי.",
]


def tokenizer_for(snap):
    from tokenizers import Tokenizer
    tok = Tokenizer.from_file(str(snap / "tokenizer.json"))
    # iahlt's and golem's tokenizer.json pad every input to a fixed 512 (and some truncate);
    # the raw library applies that, transformers.js and AutoTokenizer do not. Off, so checks
    # see the tokens the product sees.
    tok.no_padding()
    tok.no_truncation()
    return tok


def feeds_for(enc_ids, input_names):
    import numpy as np
    ids = np.array([enc_ids], dtype=np.int64)
    f = {"input_ids": ids, "attention_mask": np.ones_like(ids)}
    if "token_type_ids" in input_names:
        f["token_type_ids"] = np.zeros_like(ids)
    return f


def export_onnx(model, cfg, out_path, xlmr):
    import torch
    names = ["input_ids", "attention_mask"] + ([] if xlmr else ["token_type_ids"])
    ex = torch.tensor([[1, 500, 600, 700, 2]], dtype=torch.long)
    args = (ex, torch.ones_like(ex)) + (() if xlmr else (torch.zeros_like(ex),))
    dyn = {n: {0: "batch_size", 1: "sequence_length"} for n in names}
    dyn["logits"] = {0: "batch_size", 1: "sequence_length"}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with torch.no_grad():
        # dynamo=False: the TorchScript exporter, which is what produced the shipped graph (opset 14,
        # LayerNorm and GELU decomposed, one MatMul per projection)
        torch.onnx.export(model, args, str(out_path), input_names=names, output_names=["logits"],
                          dynamic_axes=dyn, opset_version=OPSET, do_constant_folding=True, dynamo=False)


def logit_check(model, onnx_path, tok, xlmr):
    """Max |PyTorch - ORT| over the invented sentences, plus the ids-level argmax agreement."""
    import numpy as np
    import onnxruntime as ort
    import torch
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inames = [i.name for i in sess.get_inputs()]
    worst, agree, total = 0.0, 0, 0
    for s in SENTENCES:
        ids = tok.encode(s).ids
        f = feeds_for(ids, inames)
        with torch.no_grad():
            kw = {k: torch.from_numpy(v) for k, v in f.items()}
            pt = model(**kw).logits.numpy()
        ox = sess.run(["logits"], f)[0]
        worst = max(worst, float(np.abs(pt - ox).max()))
        agree += int((pt.argmax(-1) == ox.argmax(-1)).sum())
        total += pt.shape[1]
    return worst, agree / total


def quantize_q8(src, dst):
    """The shipped onnx-community q8 recipe (EXPORTS.md): ORT dynamic IntegerOps quantization,
    int8 weights per channel with reduce_range, uint8 activations, every quantizable op type,
    MatMul only where B is a constant. This is transformers.js scripts/quantize.py's q8 mode.
    ActivationSymmetric=True: the shipped file's embedding Gathers are uint8 with zero point 128.
    The ORT that made it quantized a Gather's table with the weight symmetry; ORT 1.29 uses the
    activation symmetry (default asymmetric), which changed every embedding value. Dynamic
    activations are computed at run time by DynamicQuantizeLinear and are not affected."""
    import onnx
    from onnxruntime.quantization import QuantType
    from onnxruntime.quantization.onnx_quantizer import ONNXQuantizer
    from onnxruntime.quantization.quant_utils import QuantizationMode
    from onnxruntime.quantization.registry import IntegerOpsRegistry
    model = onnx.load_model(str(src))
    q = ONNXQuantizer(model, True, True, QuantizationMode.IntegerOps, False,
                      QuantType.QInt8, QuantType.QUInt8, None, [], [],
                      list(IntegerOpsRegistry.keys()),
                      extra_options=dict(EnableSubgraph=True, MatMulConstBOnly=True, ActivationSymmetric=True))
    q.quantize_model()
    onnx.save_model(q.model.model, str(dst))


def q8_agreement(a_path, b_path, tok, texts, o_id, win=510):
    """Share of tokens whose argmax label is the same under two ONNX files, over texts split
    into windows of win tokens. Also the share among tokens either file tags as an entity."""
    import onnxruntime as ort
    A = ort.InferenceSession(str(a_path), providers=["CPUExecutionProvider"])
    B = ort.InferenceSession(str(b_path), providers=["CPUExecutionProvider"])
    inames = [i.name for i in A.get_inputs()]
    # BERT's [CLS]/[SEP], or XLM-R's <s>/</s>
    cls_id = tok.token_to_id("[CLS]") if tok.token_to_id("[CLS]") is not None else tok.token_to_id("<s>")
    sep_id = tok.token_to_id("[SEP]") if tok.token_to_id("[SEP]") is not None else tok.token_to_id("</s>")
    same = tot = ent_same = ent_tot = 0
    for t in texts:
        body = tok.encode(t, add_special_tokens=False).ids
        for i in range(0, len(body), win):
            ids = [cls_id] + body[i:i + win] + [sep_id]
            f = feeds_for(ids, inames)
            la = A.run(["logits"], f)[0][0, 1:-1].argmax(-1)
            lb = B.run(["logits"], f)[0][0, 1:-1].argmax(-1)
            same += int((la == lb).sum()); tot += len(la)
            ent = (la != o_id) | (lb != o_id)
            ent_same += int((la[ent] == lb[ent]).sum()); ent_tot += int(ent.sum())
    return same, tot, ent_same, ent_tot


def scale_diff(a_path, b_path):
    """Compares the quantization parameters of two q8 files node by node (by node name):
    identical scales mean the same weights went through the same recipe."""
    import numpy as np
    import onnx
    from onnx import numpy_helper

    def params(p):
        m = onnx.load(str(p))
        init = {i.name: i for i in m.graph.initializer}
        out = {}
        for n in m.graph.node:
            # Gather holds the quantized embedding tables, the part an ORT upgrade changed once
            if n.op_type in ("MatMulInteger", "DequantizeLinear", "Gather"):
                for j, name in enumerate(n.input):
                    if name in init and (name.endswith("_scale") or name.endswith("_zero_point") or name.endswith("_quantized")):
                        out[(n.name, j)] = numpy_helper.to_array(init[name])
            # the scale of a MatMulInteger's weight sits on the Mul after it; collect by node name too
            if n.op_type == "Mul":
                for j, name in enumerate(n.input):
                    if name in init and name.endswith("_scale"):
                        out[(n.name, j)] = numpy_helper.to_array(init[name])
        return out
    pa, pb = params(a_path), params(b_path)
    common = set(pa) & set(pb)
    worst, qdiff = 0.0, 0
    for k in common:
        a, b = pa[k], pb[k]
        if a.shape != b.shape:
            worst = float("inf"); continue
        if a.dtype.kind == "f":
            worst = max(worst, float(np.abs(a.astype(np.float64) - b.astype(np.float64)).max()) if a.size else 0.0)
        else:
            qdiff += int((a.astype(np.int32) != b.astype(np.int32)).sum())
    return {"paramsA": len(pa), "paramsB": len(pb), "common": len(common), "maxScaleDiff": worst, "quantValuesDiffering": qdiff}


def op_counts(p):
    import collections
    import onnx
    m = onnx.load(str(p), load_external_data=False)
    return dict(sorted(collections.Counter(n.op_type for n in m.graph.node).items()))


# ---------------------------------------------------------------- commands

def out_dir(key):
    return CACHE / key


def write_layout(key, snap, cfg):
    """config.json with id2label, tokenizer files as transformers.js expects next to onnx/."""
    import shutil
    d = out_dir(key)
    (d / "onnx").mkdir(parents=True, exist_ok=True)
    cfg.to_json_file(str(d / "config.json"))
    for n in ("tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "sentencepiece.bpe.model"):
        if (snap / n).exists():
            shutil.copyfile(snap / n, d / n)
    if (snap / "README.md").exists():
        shutil.copyfile(snap / "README.md", d / "SOURCE_README.md")  # the licence and data claims, kept with the file


def export_one(key):
    t0 = time.time()
    m = MODELS[key]
    snap = fetch(key)
    model, cfg, rep = build_model(key, snap)
    log(key, "loaded", {k: v for k, v in rep.items() if k not in ("missing", "unexpected")},
        "unexpected", len(rep["unexpected"]))
    d = out_dir(key)
    # from here the files get overwritten; an old export.json left behind by a run that fails
    # below would let the registry describe files that are no longer there
    (d / "export.json").unlink(missing_ok=True)
    write_layout(key, snap, cfg)
    fp32, q8 = d / "onnx/model.onnx", d / "onnx/model_quantized.onnx"
    xlmr = m["arch"] == "xlm-roberta"
    export_onnx(model, cfg, fp32, xlmr)
    tok = tokenizer_for(snap)
    diff, agree = logit_check(model, fp32, tok, xlmr)
    log(key, "fp32 logit max diff", f"{diff:.2e}", "argmax agreement", agree)
    ok = diff < MAX_DIFF
    quantize_q8(fp32, q8)
    import numpy as np
    import onnxruntime as ort
    # how far q8 moves the labels on the same sentences: a sanity check, not a gate
    s32 = ort.InferenceSession(str(fp32), providers=["CPUExecutionProvider"])
    s8 = ort.InferenceSession(str(q8), providers=["CPUExecutionProvider"])
    inames = [i.name for i in s32.get_inputs()]
    a = t = 0
    for s in SENTENCES:
        f = feeds_for(tok.encode(s).ids, inames)
        x, y = s32.run(["logits"], f)[0].argmax(-1), s8.run(["logits"], f)[0].argmax(-1)
        a += int((x == y).sum()); t += x.size
    rec = {
        "key": key, "repo": m["repo"], "revision": m["revision"], "arch": m["arch"],
        "opset": OPSET, "logitMaxDiff": diff, "logitOk": ok, "fp32VsQ8Argmax": a / t,
        "fp32": {"bytes": fp32.stat().st_size, "sha256": sha256(fp32)},
        "q8": {"bytes": q8.stat().st_size, "sha256": sha256(q8)},
        "q8Ops": op_counts(q8), "load": rep, "id2label": {int(k): v for k, v in cfg.id2label.items()},
        "inputs": inames, "seconds": round(time.time() - t0),
    }
    (d / "export.json").write_text(json.dumps(rec, indent=1, ensure_ascii=False), "utf8", newline="\n")
    log(key, "done", "ok" if ok else "LOGIT DIFF TOO LARGE", rec["q8"]["bytes"], "bytes q8", rec["seconds"], "s")
    del model
    return rec


def cmd_recipe_check():
    """Re-exports today's model with this recipe and compares it with the shipped q8 file."""
    rec = export_one("recipe-base")
    snap = fetch("recipe-base")
    tok = tokenizer_for(snap)
    texts = [p.read_text("utf8") for p in sorted((REPO / "bench/corpus").glob("*.txt"))]
    mine = out_dir("recipe-base") / "onnx/model_quantized.onnx"
    o_id = [i for i, l in rec["id2label"].items() if l == "O"][0]
    same, tot, es, et = q8_agreement(mine, SHIPPED_Q8, tok, texts, o_id)
    sd = scale_diff(mine, SHIPPED_Q8)
    res = {"texts": len(texts), "tokens": tot, "agree": same, "agreement": same / tot,
           "entityTokens": et, "entityAgree": es, "entityAgreement": (es / et) if et else None,
           "pass": same / tot >= 0.995, "shippedBytes": SHIPPED_Q8.stat().st_size, "mineBytes": rec["q8"]["bytes"],
           "shippedOps": op_counts(SHIPPED_Q8), "mineOps": rec["q8Ops"], "params": sd}
    (out_dir("recipe-base") / "recipe-check.json").write_text(json.dumps(res, indent=1), "utf8", newline="\n")
    log("recipe check", json.dumps({k: v for k, v in res.items() if k not in ("shippedOps", "mineOps")}))
    # the fp32 plumbing (mask, scaling, Constant nodes) differs with the exporter version; the
    # quantized ops (MatMulInteger, DynamicQuantizeLinear, DequantizeLinear) must not
    qops = ("MatMulInteger", "DynamicQuantizeLinear", "DequantizeLinear")
    log("quantized ops equal", all(res["shippedOps"].get(o) == res["mineOps"].get(o) for o in qops))
    return res


def cmd_agreement(keys):
    """How far q8 moves each model's labels from its own fp32, on the synthetic corpus texts
    (bench/corpus/*.txt): quantization cost differs by model, and the plan scores both."""
    texts = [p.read_text("utf8") for p in sorted((REPO / "bench/corpus").glob("*.txt"))]
    for k in keys or ["recipe-base"] + EXPORT_ORDER:
        d = out_dir(k)
        p = d / "export.json"
        rec = json.loads(p.read_text("utf8"))
        o_id = int([i for i, l in rec["id2label"].items() if l == "O"][0])
        same, tot, es, et = q8_agreement(d / "onnx/model.onnx", d / "onnx/model_quantized.onnx", tokenizer_for(d), texts, o_id)
        rec["corpusQ8VsFp32"] = {"tokens": tot, "agreement": same / tot, "entityTokens": et, "entityAgreement": es / et if et else None}
        p.write_text(json.dumps(rec, indent=1, ensure_ascii=False), "utf8", newline="\n")
        log(k, "q8 vs fp32 on corpus", json.dumps(rec["corpusQ8VsFp32"]))


def cmd_export(keys):
    rc = out_dir("recipe-base") / "recipe-check.json"
    if not rc.exists() or not json.loads(rc.read_text("utf8"))["pass"]:
        raise SystemExit("run recipe-check first; the recipe must reproduce the shipped q8")
    for k in keys or EXPORT_ORDER:
        try:
            export_one(k)
        except SystemExit as e:
            log(k, "FAILED", e)
        except Exception as e:  # one bad model must not stop the others
            log(k, "FAILED", type(e).__name__, str(e)[:300])


# ---------------------------------------------------------------- registry

PREFIXED = ("B-", "I-", "E-", "S-", "L-", "U-", "B_", "I_", "E_", "S_")
TO_KIND = {"PER": "PER", "PERS": "PER", "PERSON": "PER", "FIRST_NAME": "PER", "LAST_NAME": "PER",
           "ORG": "ORG", "GPE": "PLACE", "LOC": "PLACE", "FAC": "PLACE",
           "CITY": "PLACE", "STREET": "PLACE", "POSTAL_CODE": "PLACE"}
# Types dropped on purpose (null in labelMap): the NEMO/IAHLT non-name types, the same list as
# base-q8 in registry.json, and golem's number/contact types, which the product finds by pattern.
# A type in neither table stops the registry: a new name type must not become null by default.
DROP = {"ANG", "DUC", "EVE", "WOA", "INFORMAL", "MISC", "TIMEX", "TTL",
        "BANK_ACCOUNT_NUM", "CC_NUM", "CC_PROVIDER", "DATE", "EMAIL", "ID_NUM", "PHONE_NUM"}


def split_label(lab):
    if lab == "O":
        return None, None
    for p in PREFIXED:
        if lab.startswith(p):
            return p[0], lab[2:]
    return None, lab


def label_scheme(labels):
    prefixes = {split_label(l)[0] for l in labels if l != "O"}
    under = any(l[1:2] == "_" for l in labels if l != "O")
    if under and prefixes <= {"B"}:
        return "B_only"
    if prefixes & {"E", "S"}:
        return "BIOES"
    # bare type names ("PER") are IO too: every token of a run carries the same label
    if prefixes in ({"I"}, {None}):
        return "IO"
    if prefixes == {"B", "I"}:
        return "BIO"
    raise ValueError(f"unknown label scheme: prefixes {sorted(map(str, prefixes))}")


def label_map(labels):
    types = sorted({split_label(l)[1] for l in labels if l != "O"})
    unknown = [t for t in types if t.upper() not in TO_KIND and t.upper() not in DROP]
    if unknown:
        raise ValueError(f"label types in neither TO_KIND nor DROP: {unknown}")
    return {t: TO_KIND.get(t.upper()) for t in types}


def tokenizer_kind(key):
    tj = json.loads((out_dir(key) / "tokenizer.json").read_text("utf8"))
    return {"WordPiece": "wordpiece", "Unigram": "sentencepiece", "BPE": "bpe"}.get(tj["model"]["type"], tj["model"]["type"])


def registry_entries(key, rec):
    m = MODELS[key]
    labels = [rec["id2label"][str(i)] for i in range(len(rec["id2label"]))]  # JSON keys are strings
    lm = label_map(labels)
    dropped = sorted(t for t, v in lm.items() if v is None)
    base = {"repo": m["repo"], "revision": m["revision"], "source": "local",
            "localPath": str(out_dir(key)).replace("\\", "/"),
            "labelScheme": label_scheme(labels), "labelMap": lm, "tokenizer": tokenizer_kind(key),
            "licence": m["licence"], "shippable": m["licence"] in SHIPPABLE, "tier": m.get("tier", 1),
            "trainedOn": m["trainedOn"]}
    note = "; ".join(x for x in [m.get("notes", ""), "export " + ("clean" if rec["logitOk"] else "LOGIT DIFF OVER 1e-3"),
                                 f"logit max diff {rec['logitMaxDiff']:.1e}",
                                 "dropped types: " + ",".join(dropped) if dropped else ""] if x)
    q8 = dict({"key": key, "dtype": "q8", "file": "onnx/model_quantized.onnx", "sha256": rec["q8"]["sha256"], "bytes": rec["q8"]["bytes"]},
              **base, notes=note)
    fp = dict({"key": key + "-fp32", "dtype": "fp32", "file": "onnx/model.onnx", "sha256": rec["fp32"]["sha256"], "bytes": rec["fp32"]["bytes"]},
              **base, notes="fp32 reference of " + key + "; " + note)
    order = ["key", "repo", "revision", "dtype", "file", "sha256", "bytes", "source", "localPath", "labelScheme", "labelMap",
             "tokenizer", "licence", "shippable", "tier", "trainedOn", "notes"]
    return [{k: e[k] for k in order} for e in (q8, fp)]


def cmd_registry():
    out = []
    for k in EXPORT_ORDER:
        p = out_dir(k) / "export.json"
        if not p.exists():
            log(k, "not exported, left out of the registry")
            continue
        rec = json.loads(p.read_text("utf8"))
        if not rec["logitOk"]:
            log(k, "logit check failed, left out of the registry")
            continue
        out.extend(registry_entries(k, rec))
    dst = HERE / "registry.exports.json"
    # LF: FORMATS.md's layout, and the test compares the file byte for byte with a re-serialisation
    dst.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", "utf8", newline="\n")
    log("wrote", dst, len(out), "entries")


if __name__ == "__main__":
    cmd, rest = (sys.argv[1] if len(sys.argv) > 1 else "help"), sys.argv[2:]
    if cmd == "download":
        cmd_download(rest)
    elif cmd == "recipe-check":
        cmd_recipe_check()
    elif cmd == "export":
        cmd_export(rest)
    elif cmd == "registry":
        cmd_registry()
    elif cmd == "agreement":
        cmd_agreement(rest)
    else:
        print(__doc__)
