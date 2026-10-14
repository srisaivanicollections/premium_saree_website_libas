import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("../saree-finder.js", import.meta.url), "utf8");
const aiSource = readFileSync(new URL("../saree-occasion-ai.js", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = source.indexOf("  const OCCASION_VALUES=new Set(");
const end = source.indexOf("  // Customer-side image inference is intentionally disabled.", start);
assert.ok(start >= 0 && end > start, "Finder occasion helpers must be present");
const helpers = new Function(source.slice(start, end) + "\nreturn { inferOccasions, matchesOccasion };")();
const { inferOccasions, matchesOccasion } = helpers;

test("explicit Admin tags take precedence over contradictory description keywords", () => {
  assert.deepEqual(inferOccasions({ occasions: ["Wedding"], name: "Everyday cotton saree" }), ["wedding"]);
  assert.equal(matchesOccasion({ occasions: ["Wedding"], name: "Everyday cotton saree" }, "Daily Wear"), false);
  assert.equal(matchesOccasion({ occasions: ["Wedding"] }, " wedding "), true);
});

test("empty or missing tags use conservative descriptive-field inference", () => {
  assert.equal(matchesOccasion({ occasions: [], name: "Diwali collection saree" }, "Festive"), true);
  assert.equal(matchesOccasion({ name: "Office Wear Cotton Saree" }, "Daily Wear"), true);
  assert.equal(matchesOccasion({ description: "Traditional wear handloom ikat" }, "Traditional"), true);
  assert.equal(matchesOccasion({ name: "Party Wear Sequins Dress" }, "Party Wear"), true);
});

test("fabric and embellishment alone do not guess daily wear, wedding or festive", () => {
  const cotton = { name: "Cotton saree", material: "cotton" };
  assert.equal(matchesOccasion(cotton, "Daily Wear"), false);
  const pattu = { name: "Pattu saree" };
  assert.equal(matchesOccasion(pattu, "Wedding"), false);
  assert.equal(matchesOccasion(pattu, "Traditional"), false);
  assert.equal(matchesOccasion({ name: "Zari silk saree" }, "Festive"), false);
});

test("empty metadata has no inferred occasion, while Any occasion always matches", () => {
  const unknown = { name: "", description: "", material: "", fabric: "", style: "", type: "", subcategory: "", tags: [] };
  assert.deepEqual(inferOccasions(unknown), []);
  assert.equal(matchesOccasion(unknown, ""), true);
  assert.equal(matchesOccasion(unknown, "Wedding"), false);
});

test("normalizes and deduplicates explicit tags", () => {
  assert.deepEqual(inferOccasions({ occasions: [" Wedding ", "wedding", "", null] }), ["wedding"]);
});


test("browser image inference uses the WASM-compatible uint8 model artifact", () => {
  assert.match(aiSource, /device:\s*"wasm"/, "Image inference must retain browser WASM execution");
  assert.match(aiSource, /dtype:\s*"uint8"/, "Avoid the q8 artifact that fails on ConvInteger during WASM session creation");
  assert.doesNotMatch(aiSource, /dtype:\s*"q8"/, "Do not select the incompatible q8 artifact");
  assert.match(aiSource, /pipeline\("zero-shot-image-classification",\s*MODEL_ID/, "Keep the existing free zero-shot image classification pipeline");
});


test("Admin enrichment exposes actionable safe failure diagnostics", () => {
  assert.match(adminSource, /function ssvFinderFailureReason\(error\)/);
  assert.match(adminSource, /GitHub denied access \(403\)/);
  assert.match(adminSource, /Network\/CDN request failed/);
  assert.match(adminSource, /console\.error\("Finder enrichment failed for product "/);
  assert.match(adminSource, /Details: "\+failures\.map/);
});

test("Admin enrichment verifies persisted metadata before counting a product update", () => {
  assert.match(adminSource, /githubWriteJson\("data\/products\.json"/);
  assert.match(adminSource, /githubReadJsonFresh\("data\/products\.json"\)/);
  assert.match(adminSource, /Save verification failed/);
  assert.match(adminSource, /isGithubShaConflict\(e\)/);
});

test("Enrich Finder button resets after the catalogue view is rerendered", () => {
  assert.match(adminSource, /const currentButton=\$\("#adminEnrichFinder"\)/);
  assert.match(adminSource, /currentButton\.disabled=false;currentButton\.textContent="Enrich Finder"/);
});
