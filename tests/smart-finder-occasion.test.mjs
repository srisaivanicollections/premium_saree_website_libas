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
  assert.match(aiSource, /device:\s*"wasm"/);
  assert.match(aiSource, /dtype:\s*"uint8"/);
  assert.doesNotMatch(aiSource, /dtype:\s*"q8"/);
  assert.match(aiSource, /pipeline\("zero-shot-image-classification",\s*MODEL_ID/);
});

test("occasion rankings survive an independent colour-inference failure", () => {
  assert.match(aiSource, /const predictions = await classifier\(url,/);
  assert.match(aiSource, /let colour = null;/);
  assert.match(aiSource, /const colourPredictions = await classifier\(url,/);
  assert.match(aiSource, /colourError = error;/);
  assert.doesNotMatch(aiSource, /catch\s*\(error\)\s*\{\s*console\.warn\("Finder (occasion|colour) inference was inconclusive:/);
  assert.match(aiSource, /Runtime\/image\/model errors deliberately propagate/);
  assert.match(aiSource, /const combined = \{ occasion, colour, colourError \}/);
});

test("uncertain predictions are not cached and an explicit retry bypasses cached results", () => {
  assert.match(aiSource, /if \(!options\.retry && resultCache\.has\(cacheKey\)\)/);
  assert.match(aiSource, /if \(occasion\.confident && colour\?\.confident\) resultCache\.set\(cacheKey, combined\)/);
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

test("Enrich Finder is a Products-page text link that opens a closable popup, not a separate tab", () => {
  assert.match(adminSource, /id="adminEnrichFinderLink" class="admin-enrich-finder-link"/);
  assert.match(adminSource, /function ssvOpenEnrichFinderPopup\(\)/);
  assert.match(adminSource, /id="adminEnrichFinderPopup"/);
  assert.match(adminSource, /id="adminEnrichFinderClose" aria-label="Close Enrich Finder"/);
  assert.doesNotMatch(adminSource, /data-view="enrich">ENRICH FINDER/);
  assert.match(adminSource, /event\.key==="Escape"&&!popup\.hidden/);
});

test("closing and reopening the enrichment popup does not cancel or duplicate a running save", () => {
  assert.match(adminSource, /if\(button\.disabled\|\|ssvFinderEnrichmentPromise\)return/);
  assert.match(adminSource, /if\(ssvFinderEnrichmentPromise&&button\)\{button\.disabled=true/);
  assert.match(adminSource, /const close=\(\)=>\{if\(popup\.hidden\|\|popup\.classList\.contains\("is-closing"\)\)return/);
  assert.match(adminSource, /popup\._closeTimer=setTimeout/);
  assert.match(adminSource, /clearTimeout\(popup\._closeTimer\)/);
  assert.match(adminSource, /popup\.removeEventListener\("animationend",popup\._closeHandler\)/);
  assert.match(adminSource, /function ssvRenderEnrichFinderSummary\(result\)/);
});

test("Enrich Finder reports saved counts, a deduplicated review count, and actionable diagnostics", () => {
  assert.match(adminSource, /occasionMissingCount=queue\.filter/);
  assert.match(adminSource, /colourMissingCount=queue\.filter/);
  assert.match(adminSource, /occasion\.textContent=String\(result\.occasionsSaved\)/);
  assert.match(adminSource, /colour\.textContent=String\(result\.coloursSaved\)/);
  assert.match(adminSource, /const reviewCount=reviewIds\.size/);
  assert.match(adminSource, /Occasion prediction is uncertain\. Review the ranked suggestions/);
  assert.match(adminSource, /Processing failures:/);
});

test("ambiguous catalogue writes are re-read before reporting an unknown outcome", () => {
  assert.match(adminSource, /Save outcome unknown/);
  assert.match(adminSource, /const recovery=await githubReadJsonFresh\("data\/products\.json"\)/);
  assert.match(adminSource, /persisted\.image===current\.image/);
});

test("Enrichment candidate selection and field counts share one eligibility decision", () => {
  assert.match(adminSource, /function ssvEnrichFieldNeeds\(product\)/);
  assert.match(adminSource, /occasion:eligible&&ssvHasNoOccasionMetadata\(product\)&&!ssvHasOccasionDecision\(product\)/);
  assert.match(adminSource, /products:needs\.filter\(item=>item\.occasion\|\|item\.colour\)\.length/);
  assert.match(adminSource, /ssvEnrichFieldNeeds\(p\)\.occasion\|\|ssvEnrichFieldNeeds\(p\)\.colour/);
  assert.match(adminSource, /const candidateNeeds=ssvEnrichFieldNeeds\(candidate\)/);
});

test("Enrich Finder popup traps keyboard focus and restores focus to its opener", () => {
  assert.match(adminSource, /popup\.addEventListener\("keydown",event=>\{/);
  assert.match(adminSource, /event\.shiftKey&&\(document\.activeElement===first\|\|!popup\.contains\(document\.activeElement\)\)/);
  assert.match(adminSource, /document\.activeElement===last\|\|!popup\.contains\(document\.activeElement\)/);
  assert.match(adminSource, /const opener=popup\._opener;if\(opener&&opener\.isConnected\)opener\.focus\(\)/);
  assert.match(adminSource, /if\(popup\.hidden\)popup\._opener=document\.activeElement/);
});

test("A failed final catalogue refresh preserves partial-save results and warns before retry", () => {
  assert.match(adminSource, /let refreshFailed=false/);
  assert.match(adminSource, /Final catalogue refresh failed\. Some saves may already be complete\. Refresh the catalogue before retrying\./);
  assert.match(adminSource, /refreshFailed\};/);
  assert.match(adminSource, /result\.refreshFailed\?"Partial results":"Complete"/);
  assert.match(adminSource, /result\.failed\|\|result\.refreshFailed\?"error":"success"/);
});


test("uncertain occasion enrichment retains all ranked suggestions and exposes manual multi-occasion saving", () => {
  assert.match(aiSource, /rankings: ranked/);
  assert.match(adminSource, /reviewSuggestions\.push\(\{id:candidate\.id,name:/);
  assert.match(adminSource, /SAVE SELECTED OCCASIONS/);
  assert.match(adminSource, /occasion prediction is uncertain/i);
  assert.match(adminSource, /ssvSaveReviewedOccasions\(productId,imagePath,selectedLabels\)/);
  assert.match(adminSource, /source:"ai-reviewed"/);
  assert.match(adminSource, /if\(!ssvHasNoOccasionMetadata\(current\)\|\|ssvHasOccasionDecision\(current\)\)/);
  assert.match(adminSource, /The product image changed since analysis/);
  assert.match(adminSource, /This product category is currently disabled/);
});

test("manual occasion review preserves existing product fields and verifies the saved image and tags", () => {
  assert.match(adminSource, /const next=\{\.\.\.current,occasions:labels\}/);
  assert.match(adminSource, /await githubWriteJson\("data\/products\.json"/);
  assert.match(adminSource, /JSON\.stringify\(saved\.occasions\)!==JSON\.stringify\(labels\)/);
  assert.match(adminSource, /saved\.occasionMetadata\?\.source!=="ai-reviewed"/);
});


test("concurrent occasion review saves filter the latest result list instead of a stale captured array", () => {
  assert.ok(adminSource.includes('result.reviewSuggestions=(Array.isArray(result.reviewSuggestions)?result.reviewSuggestions:[]).filter(item=>String(item.id)!==String(suggestion.id));'));
  assert.ok(!adminSource.includes('result.reviewSuggestions=suggestions.filter(item=>String(item.id)!==String(suggestion.id));'));
});

 
test("manual occasion review shows product image and identity with mobile-safe review controls", () => {
  assert.match(adminSource, /ssv-enrich-review-image/);
  assert.match(adminSource, /preview\.src=String\(suggestion\.image\|\|\"\"\)/);
  assert.match(adminSource, /suggestion\.name\+" product image"/);
  assert.match(adminSource, /suggestion\.category\?" · "\+suggestion\.category/);
  assert.match(adminSource, /max-width:100vw/);
  assert.match(adminSource, /ssv-enrich-review-card button\{min-height:44px/);
  assert.match(adminSource, /overflow-wrap:anywhere/);
});

test("Enrich Finder close animation and final badge sizing overrides exist", () => {
  assert.match(adminSource, /popup\.classList\.add\("is-closing"\)/);
  assert.match(adminSource, /ssvEnrichBackdropOut/);
  assert.match(adminSource, /id="enrich-finder-and-badge-final-overrides"/);
  assert.match(adminSource, /\.lux-item-media \.ssv-badge-pill/);
  assert.match(adminSource, /\.ssv-finder-image-wrap>\.ssv-finder-top-pick/);
  assert.match(adminSource, /font-size:7\.5px!important/);
  assert.match(adminSource, /prefers-reduced-motion:reduce/);
});


test("Enrich Finder keeps ranked occasion suggestions for a single uncertain product image", () => {
  assert.match(aiSource, /const predictions = await classifier\(url,/);
  assert.match(aiSource, /rankings: ranked/);
  assert.match(adminSource, /if\(needsOccasion&&!addOccasion\)\{[\s\S]*?const ranked=Array\.isArray\(occasion\?\.rankings\)/);
  assert.match(adminSource, /reviewSuggestions\.push\(\{id:candidate\.id,name:/);
  assert.match(adminSource, /rankings:ranked/);
  assert.match(adminSource, /Occasion prediction is uncertain\. Review the ranked suggestions/);
  assert.match(adminSource, /SAVE SELECTED OCCASIONS/);
});

test("TOP PICK sizing targets the rendered Smart Finder badge without adding popup entrance animation", () => {
  assert.match(adminSource, /id="ssv-enrich-finder-final-polish-20261015"/);
  assert.match(adminSource, /\.ssv-finder-top-pick\{[\s\S]*?font-size:8px!important/);
  assert.match(adminSource, /@media\(max-width:600px\)\{[\s\S]*?font-size:8px!important/);
  assert.doesNotMatch(adminSource, /ssv-enrich-popup-backdrop:not\(\[hidden\]\).*animation:ssvEnrichBackdropIn/);
  assert.doesNotMatch(adminSource, /ssv-enrich-popup-backdrop:not\(\[hidden\]\) \.ssv-enrich-popup\{animation:ssvEnrichPanelIn/);
  assert.match(adminSource, /@media\(prefers-reduced-motion:reduce\)/);
});


test("Enrich Finder exposes real processing progress and honours reduced motion", () => {
  assert.match(adminSource, /id="adminEnrichProgressTrack"/);
  assert.match(adminSource, /onProgress:ssvUpdateEnrichProgress/);
  assert.match(adminSource, /index:i\+1,total:queue\.length,product:candidate/);
  assert.match(adminSource, /@keyframes ssvEnrichGoldFlow/);
  assert.match(adminSource, /prefers-reduced-motion:reduce\)\{\.ssv-enrich-scan-icon/);
});


const rankStart = source.indexOf("  function rankFinderProducts(");
const rankEnd = source.indexOf("\n  // Customer-side image inference is intentionally disabled.", rankStart);
assert.ok(rankStart >= 0 && rankEnd > rankStart, "Finder ranking helper must be present");
const rankFinderProducts = new Function(source.slice(rankStart, rankEnd) + "\nreturn rankFinderProducts;")();

test("a strong bestseller stays ahead of a much cheaper new arrival with a selected budget", () => {
  const products = [
    { id: 1, price: 1000, bestSeller: true, newArrival: true },
    { id: 2, price: 100, bestSeller: false, newArrival: true }
  ];
  assert.deepEqual(rankFinderProducts(products, 1000).map(product => product.id), [1, 2]);
});

test("a very large saving can overcome one merchandising tier, but not the strongest combined signal", () => {
  const products = [
    { id: 1, price: 990, bestSeller: true, newArrival: false },
    { id: 2, price: 10, bestSeller: false, newArrival: true }
  ];
  assert.deepEqual(rankFinderProducts(products, 1000).map(product => product.id), [2, 1]);
  const strongest = [
    { id: 3, price: 1000, bestSeller: true, newArrival: true },
    { id: 2, price: 100, bestSeller: false, newArrival: true }
  ];
  assert.deepEqual(rankFinderProducts(strongest, 1000).map(product => product.id), [3, 2]);
});

test("affordability improves ranking among equally merchandised products", () => {
  const products = [
    { id: 1, price: 900, bestSeller: false, newArrival: false },
    { id: 2, price: 100, bestSeller: false, newArrival: false }
  ];
  assert.deepEqual(rankFinderProducts(products, 1000).map(product => product.id), [2, 1]);
});

test("without a budget, merchandising relevance stays primary and price breaks ties", () => {
  const products = [
    { id: 3, price: 900, bestSeller: true, newArrival: true },
    { id: 2, price: 500, bestSeller: true, newArrival: true },
    { id: 1, price: 100, bestSeller: false, newArrival: true }
  ];
  assert.deepEqual(rankFinderProducts(products, null).map(product => product.id), [2, 3, 1]);
});

test("ranking ties are deterministic and independent of catalogue order", () => {
  const products = [
    { id: 12, price: 400, bestSeller: true, newArrival: false },
    { id: 3, price: 400, bestSeller: true, newArrival: false },
    { id: 8, price: 400, bestSeller: true, newArrival: false }
  ];
  const expected = [3, 8, 12];
  assert.deepEqual(rankFinderProducts(products, null).map(product => product.id), expected);
  assert.deepEqual(rankFinderProducts([...products].reverse(), null).map(product => product.id), expected);
});

test("budget ranking is relevance-first, affordability-aware, and respects the hard budget", () => {
  const products = [
    { id: 1, price: 900, bestSeller: false, newArrival: false },
    { id: 2, price: 100, bestSeller: false, newArrival: false }
  ];
  assert.deepEqual(rankFinderProducts(products, 1000).map(product => product.id), [2, 1]);
  assert.match(source, /allMatches=allMatches\.filter\(p=>Number\(p\.price\)<=budget\)/);
  assert.match(source, /badges\.push\("Budget-Friendly"\)/);
  assert.match(source, /ssv-finder-budget-friendly/);
  assert.match(source, /normalizedMerchandising\*0\.7/);
  assert.match(source, /affordabilityScore\*0\.3/);
});

test("customer-facing Finder copy uses Colour wording", () => {
  assert.doesNotMatch(source, /recorded colour/i);
  assert.match(source, /Preferred colour/);
  assert.match(source, /Colour: /);
});
