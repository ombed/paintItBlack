/* What the old address publishes (.github/workflows/pages.yml), read as text.

   Since the move to inkognito.co.il (the owner's decision, 6.10.2026) https://ombed.github.io/inkognito/
   serves the forward: a ref that has scripts/build-forward.js publishes it, and the live check asks for
   the moved page's marker and the handover worker, with no version and no live/vNN tag (versions and
   tags now belong to the inkognito.co.il deploys). A ref without it, a rollback to a live/vNN tag,
   publishes the tool exactly as before, so a rollback still works. */
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROOT = path.join(__dirname, "..");
const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "pages.yml"), "utf8").replace(/\r\n/g, "\n");

// jobs and their steps, by indentation: a job is "  name:", a step starts at "      - "
function jobs(text) {
  const body = text.slice(text.indexOf("\njobs:\n") + 7);
  const out = {};
  for (const block of body.split(/\n(?=  [a-z][\w-]*:\n)/)) {
    const name = (block.match(/^ {2}([a-z][\w-]*):/) || [])[1];
    if (!name) continue;
    const at = block.indexOf("\n    steps:\n");
    const head = at < 0 ? block : block.slice(0, at);
    const steps = at < 0 ? [] : block.slice(at + 12).split(/\n(?= {6}- )/).map((s) => {
      const field = (k) => (s.match(new RegExp("^ {6}(?:- | {2})" + k + ": ?(.*)$", "m")) || [])[1];
      const run = (s.match(/^ {6}(?:- | {2})run: \|\n((?: {8,}.*\n?|\n)*)/m) || [])[1] || field("run") || "";
      return { text: s, name: field("name"), id: field("id"), if: field("if"), uses: field("uses"), run };
    });
    out[name] = { head, steps };
  }
  return out;
}
const J = jobs(yml);
const step = (job, pred, what) => {
  const s = ((J[job] || {}).steps || []).find(pred);
  ok(!!s, job + ": a step " + what);
  return s || { text: "", run: "" };
};
const index = (job, s) => ((J[job] || {}).steps || []).indexOf(s);

console.log("\n— the build job decides what the ref publishes —");
ok(!!J.build && !!J.deploy && !!J.verify, "the jobs are build, deploy and verify: " + Object.keys(J).join(", "));
const kind = step("build", (s) => s.id === "kind", "with id kind");
ok(/\[ -f scripts\/build-forward\.js \]/.test(kind.run), "it asks whether the ref has scripts/build-forward.js: " + kind.run.trim());
ok(/echo "kind=forward" >> "\$GITHUB_OUTPUT"/.test(kind.run) && /echo "kind=tool" >> "\$GITHUB_OUTPUT"/.test(kind.run), "and says forward or tool");
ok(/kind=forward[\s\S]*else[\s\S]*kind=tool/.test(kind.run), "forward when it has it, the tool when it does not");
ok(/^ {6}kind: \$\{\{ steps\.kind\.outputs\.kind \}\}$/m.test(J.build.head), "the build job hands the kind on to verify");
const checkout = step("build", (s) => s.uses === "actions/checkout@v4", "that checks out the ref");
ok(index("build", checkout) < index("build", kind), "the kind is read from the ref it checked out");

console.log("\n— the forward for a ref that has its build script —");
const fwd = step("build", (s) => /node scripts\/build-forward\.js _site/.test(s.run), "that builds the forward into _site");
ok(fwd.if === "steps.kind.outputs.kind == 'forward'", "only for the forward: " + fwd.if);
const fwdCheck = step("build", (s) => /npx playwright test e2e\/moved\.spec\.js/.test(s.run), "that runs the moved page's browser checks");
ok(fwdCheck.if === "steps.kind.outputs.kind == 'forward'", "only for the forward: " + fwdCheck.if);
ok(/FORWARD_ROOT: _site/.test(fwdCheck.text), "against the folder it is about to publish (FORWARD_ROOT)");
for (const spec of (fwdCheck.run.match(/e2e\/[\w.-]+\.spec\.js/g) || [])) {
  const src = fs.existsSync(path.join(ROOT, spec)) ? fs.readFileSync(path.join(ROOT, spec), "utf8") : "";
  ok(/process\.env\.FORWARD_ROOT/.test(src), spec + " exists and serves FORWARD_ROOT when it is set");
}
ok(index("build", fwd) < index("build", fwdCheck), "built before it is checked");

console.log("\n— the tool, as before, for a ref without it (a rollback to live/vNN) —");
const tool = step("build", (s) => /node scripts\/build-site\.js _site/.test(s.run), "that builds the tool into _site");
ok(tool.if === "steps.kind.outputs.kind == 'tool'", "only for the tool: " + tool.if);
const toolCheck = step("build", (s) => /npx playwright test e2e\/flow\.spec\.js e2e\/tour\.spec\.js e2e\/ui\.spec\.js e2e\/model-host\.spec\.js/.test(s.run), "that runs the tool's four browser checks");
ok(toolCheck.if === "steps.kind.outputs.kind == 'tool'" && /SITE_ROOT: _site/.test(toolCheck.text), "only for the tool, against the built folder");
const version = step("build", (s) => s.id === "version", "that reads the version");
ok(/grep -o 'גרסה v\[0-9\]\*' _site\/index\.html/.test(version.run) && /"\$KIND" = "tool"/.test(version.run), "the version is read from a tool build only");
ok(/sha=\$\(git rev-parse HEAD\)/.test(version.run), "and the commit, for every build");
const upload = step("build", (s) => s.uses === "actions/upload-pages-artifact@v3", "that uploads _site");
ok(!upload.if && /path: _site/.test(upload.text), "whichever was built");
ok(index("build", kind) < index("build", fwd) && index("build", kind) < index("build", tool) && index("build", version) < index("build", upload), "in order: decide, build, read, upload");

console.log("\n— the live check —");
ok(/^ {6}KIND: \$\{\{ needs\.build\.outputs\.kind \}\}$/m.test(J.verify.head), "verify knows what was built");
const vco = step("verify", (s) => s.uses === "actions/checkout@v4", "that checks out the published commit");
const live = step("verify", (s) => /<meta name="inkognito" content="moved">/.test(s.run), "that looks for the moved page's marker");
ok(live.if === "needs.build.outputs.kind == 'forward'", "only for the forward: " + live.if);
ok(/curl [^\n]*https:\/\/ombed\.github\.io\/inkognito\/index\.html/.test(live.run), "on the live page");
ok(/curl [^\n]*https:\/\/ombed\.github\.io\/inkognito\/sw\.js[^\n]*-o live-sw\.js/.test(live.run) && /cmp -s live-sw\.js forward\/sw\.js/.test(live.run), "and the live sw.js is the handover worker, byte for byte");
ok(/curl [^\n]*https:\/\/ombed\.github\.io\/inkognito\/[a-z/-]+\.html/.test(live.run.replace(/index\.html/g, "")), "and an old deep link lands on the same page");
ok(index("verify", vco) < index("verify", live), "the handover worker it compares with is the published commit's");
ok(!/WANT|live\/|git tag|git push/.test(live.run), "the forward needs no version and makes no tag");
const want = step("verify", (s) => /the live site does not report/.test(s.run), "that checks the live version");
ok(want.if === "needs.build.outputs.kind == 'tool'" && /test -n "\$WANT"/.test(want.run), "only for the tool, as before");
const tag = step("verify", (s) => /git tag "\$tag" "\$SHA"/.test(s.run), "that tags what is live");
ok(tag.if === "needs.build.outputs.kind == 'tool'", "only for the tool: versions and tags now belong to the inkognito.co.il deploys");

console.log("\n— the workflow, the forward and the docs agree —");
const page = fs.readFileSync(path.join(ROOT, "forward", "index.html"), "utf8");
ok(page.includes('<meta name="inkognito" content="moved">'), "the marker the live check asks for is on the moved page");
ok(fs.existsSync(path.join(ROOT, "scripts", "build-forward.js")) && fs.existsSync(path.join(ROOT, "forward", "sw.js")), "this ref has the build script, so it publishes the forward");
const rollback = fs.readFileSync(path.join(ROOT, "docs", "ROLLBACK.md"), "utf8");
ok(/scripts\/build-forward\.js/.test(rollback) && rollback.includes('<meta name="inkognito" content="moved">') && /gh workflow run pages\.yml -f ref=live\/v\d+/.test(rollback),
  "docs/ROLLBACK.md says what the address serves and how to publish the tool again");
const deploy = fs.readFileSync(path.join(ROOT, "README.md"), "utf8").split("## פריסה")[1].split("\n## ")[0];
ok(/scripts\/build-forward\.js/.test(deploy) && /inkognito\.co\.il/.test(deploy) && /docs\/ROLLBACK\.md/.test(deploy) && /-f ref=live\/vNN/.test(deploy),
  "the README's deploy section says what the address serves and how to roll back");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
