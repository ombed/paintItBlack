import { createRequire } from "module";
const require = createRequire(import.meta.url);
const E = require("./engine.js"); // installs the RegExp wrapper first
console.log("wrapper installed:", globalThis.__nerRx === 1);
const T = await import("@huggingface/transformers");
T.env.allowLocalModels = false;
const t0 = Date.now();
let pipe;
try {
  pipe = await T.pipeline("token-classification", "onnx-community/dictabert-ner-ONNX", { dtype: "q8" });
} catch (e) { console.log("PIPELINE FAILED:", String(e.message || e).slice(0, 300)); process.exit(2); }
console.log("loaded in", ((Date.now() - t0) / 1000).toFixed(1), "s");
const text = 'עו"ד רונית לוי נסעה לחיפה ופגשה את דנה כהן-לוי במשרד הרווחה.';
const res = await pipe(text, { ignore_labels: [] });
console.log("raw entities:", res.length, "first:", JSON.stringify(res[0]));
console.log("start/end present:", res.filter((r) => r.start != null).length + "/" + res.length);
E.nerAlign(text, res, 0);
const ents = E.nerGroup(res).map((g) => ({ type: g.type, score: g.score, s: g.s, e: g.e }));
const out = E.nerClean(ents, text);
console.log("after group:", ents.length, "after clean:", out.length, "->", JSON.stringify(out.map((o) => (o.value || text.slice(o.s, o.e)) + ":" + (o.kind || o.type))));
