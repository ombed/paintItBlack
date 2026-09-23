/* The model's weights, split for the repository (GitHub refuses a file over 100 MB and warns
   over 50 MB) and joined again by the page (redact-engine.js, nerJoinParts).

     node scripts/model-parts.js <model_quantized.onnx> <models/<id>/onnx> [--parts=4]

   Writes <name>.part1 … partN of equal size (the last one takes the rest), then reads them back
   and checks that joined they are the original byte for byte: same length, same SHA-256. Prints
   what NER_SPEC.weights needs (bytes, sha256, the part names). */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function split(src, outDir, n) {
  const buf = fs.readFileSync(src);
  const name = path.basename(src);
  const size = Math.ceil(buf.length / n);
  fs.mkdirSync(outDir, { recursive: true });
  const parts = [];
  for (let i = 0; i < n; i++) {
    const p = `${name}.part${i + 1}`;
    fs.writeFileSync(path.join(outDir, p), buf.subarray(i * size, Math.min(buf.length, (i + 1) * size)));
    parts.push(p);
  }
  const joined = Buffer.concat(parts.map((p) => fs.readFileSync(path.join(outDir, p))));
  const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
  if (joined.length !== buf.length || sha(joined) !== sha(buf)) throw new Error("the joined parts differ from the original");
  return { bytes: buf.length, sha256: sha(buf), parts, partBytes: parts.map((p) => fs.statSync(path.join(outDir, p)).size) };
}

module.exports = { split };

if (require.main === module) {
  const [src, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const n = Number((process.argv.find((a) => a.startsWith("--parts=")) || "--parts=4").slice(8));
  if (!src || !outDir || !(n >= 1)) { console.error("usage: node scripts/model-parts.js <model.onnx> <out dir> [--parts=4]"); process.exit(1); }
  const r = split(src, outDir, n);
  console.log(JSON.stringify(r, null, 1));
}
