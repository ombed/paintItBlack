/* Private regression fixtures: real documents that must never enter the repo.

   The synthetic corpus is public and lives under bench/corpus. Real documents
   from real sessions are the only thing that has exposed a leak the corpus
   was blind to, and they cannot be published: even after redaction they hold
   a child's school placement, a family's affiliation, a court decision. So
   they live in a sibling folder OUTSIDE the repository:

       paintItBlack/
         repo-clone/        <- this repository
         private-bench/     <- fixtures; not a subfolder, so no `git add -f`
           r1-interview-2026-09-09/
             document.docx
             key.json       <- same schema as bench/key.json, hand-annotated

   When the folder exists, the benchmark scores every fixture in it on the same
   columns as the corpus and writes the results NEXT TO THE FIXTURES, never into
   the repository. In CI the folder does not exist and this module returns an
   empty list. PRIVATE_BENCH overrides the location.

   Each fixture's key.json may declare its own categories; they are merged for
   labelling. The stable key is the folder name, so a regression on the same
   document is comparable across months. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_DIR = path.resolve(ROOT, "..", "private-bench");

function dir() {
  return process.env.PRIVATE_BENCH ? path.resolve(process.env.PRIVATE_BENCH) : DEFAULT_DIR;
}

// a fixture folder must resolve outside the repository, whatever the env says
function outsideRepo(p) {
  const rel = path.relative(ROOT, p);
  return rel.startsWith("..") || path.isAbsolute(rel);
}

function load() {
  const base = dir();
  if (!fs.existsSync(base)) return { dir: base, docs: [], categories: {}, expectedFail: [], exemptFromDisjoint: [] };
  if (!outsideRepo(base)) throw new Error("private fixtures must live outside the repository: " + base);
  const docs = [], categories = {}, expectedFail = new Set(), exemptFromDisjoint = new Set();
  for (const name of fs.readdirSync(base).sort()) {
    const folder = path.join(base, name);
    const keyPath = path.join(folder, "key.json");
    if (!fs.statSync(folder).isDirectory() || !fs.existsSync(keyPath)) continue;
    const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    Object.assign(categories, key.categories || {});
    for (const c of key.expectedFail || []) expectedFail.add(c);
    for (const c of key.exemptFromDisjoint || []) exemptFromDisjoint.add(c);
    for (const d of key.docs || []) {
      const file = path.isAbsolute(d.file) ? d.file : path.join(folder, d.file);
      if (!fs.existsSync(file)) throw new Error("private fixture " + name + ": missing " + d.file);
      docs.push({ ...d, id: d.id || name, file, private: true, fixture: name });
    }
  }
  return { dir: base, docs, categories, expectedFail: [...expectedFail], exemptFromDisjoint: [...exemptFromDisjoint] };
}

module.exports = { load, dir, outsideRepo, ROOT };
