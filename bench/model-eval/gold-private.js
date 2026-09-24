/* Her documents as a gold set with positions (PLAN.md 4.4, FORMATS.md "Private gold sets"):
   node bench/model-eval/gold-private.js

   The same locating as the synthetic set (gold-synth.js build), on the private fixtures'
   keys (bench/private.js) and their no-model rows (for offMissed). Written only inside
   private-bench/model-eval/gold/ (private.json, private-report.json), with licence
   "private", so every harness script treats it as hers. The console gets counts only,
   through the privacy gate; an error is printed without its message. */
const fs = require("fs");
const path = require("path");
const PRIVATE = require("../private.js");
const { build } = require("./gold-synth.js");
const privacy = require("./privacy.js");

async function main() {
  const priv = PRIVATE.load();
  if (!priv.docs.length) { privacy.safeLog("private", "no", "docs"); return; }
  const key = { docs: priv.docs.map((d) => ({ id: d.id, genre: d.genre, file: d.file, entities: d.entities })) };
  const rowsFile = path.join(priv.dir, "results-no-model.json");
  const rows = fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, "utf8")).rows : [];
  const res = await build({ key, rows });
  const set = { name: "private", source: "private-bench", licence: "private", split: "all", docs: res.all.docs };
  const dir = path.join(priv.dir, "model-eval", "gold");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "private.json"), JSON.stringify(set, null, 1) + "\n");
  fs.writeFileSync(path.join(dir, "private-report.json"), JSON.stringify(res.report, null, 1) + "\n");
  const c = res.report.counts.all;
  privacy.safeLog("private", { docs: c.docs, mentions: c.mentions, must: c.must, PER: c.PER, ORG: c.ORG, PLACE: c.PLACE, offMissed: c.offMissed });
  privacy.safeLog("private", { unlocated: res.report.unlocated.length, lost: res.report.lostEntities.length, added: res.report.added.length });
}

if (require.main === module) {
  privacy.wrapErrors(main).catch((e) => { console.error(privacy.sanitise(e).stack); process.exitCode = 1; });
}
