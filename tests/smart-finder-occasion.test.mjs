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
  assert.match(aiSource, /const combined = \{ occasion, colour, colourError(?:, pixelColour)? \}/);
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

test("Enrich Finder link removes the icon underline and safety copy matches current save rules", () => {
  const styleStart = adminSource.indexOf('<style id="ssv-enrich-finder-ui-review-20261015">');
  const bodyEnd = adminSource.lastIndexOf("</body>");
  assert.ok(styleStart >= 0 && bodyEnd > styleStart, "Enrich Finder override styles must be inside the document body");
  const styleEnd = adminSource.indexOf("</style>", styleStart);
  assert.ok(styleEnd > styleStart && styleEnd < bodyEnd, "Enrich Finder override styles must close before </body>");
  assert.match(adminSource.slice(styleStart, styleEnd), /text-decoration:none!important/);
  assert.match(adminSource, /Missing occasions use the highest-scoring match\(es\)\. Colour values follow catalogue rules, and saved changes are verified\./);
  assert.doesNotMatch(adminSource, /Only confident predictions for fields that are still missing are saved\./);
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

test("Enrich Finder popup keeps model rankings and product IDs internal", () => {
  const start = adminSource.indexOf("function ssvRenderEnrichFinderSummary(result)");
  const end = adminSource.indexOf("function showView(v)", start);
  assert.ok(start >= 0 && end > start, "summary renderer must be present");
  const popupSummary = adminSource.slice(start, end);
  assert.doesNotMatch(popupSummary, /model score|Product "\+suggestion\.id|Product "\+item\.id/);
  assert.doesNotMatch(popupSummary, /rankings|model score|Colour review|option\.textContent=value/);
  assert.doesNotMatch(adminSource, /ssvSaveReviewedColour|colourReviewSuggestions|SAVE REVIEWED COLOUR/);
});

test("Enrich Finder reports saved counts, a deduplicated review count, and actionable diagnostics", () => {
  assert.match(adminSource, /occasionMissingCount=queue\.filter/);
  assert.match(adminSource, /colourMissingCount=queue\.filter/);
  assert.match(adminSource, /occasion\.textContent=String\(result\.occasionsSaved\)/);
  assert.match(adminSource, /colour\.textContent=String\(result\.coloursSaved\)/);
  assert.match(adminSource, /const failureCount=Array\.isArray\(result\.failures\)\?result\.failures\.length:0/);
  assert.match(adminSource, /const reviewIds=new Set\(\[\.\.\.\(Array\.isArray\(result\.uncertainProductIds\)\?result\.uncertainProductIds:\[\]\),\.\.\.\(Array\.isArray\(result\.uncertainColourProductIds\)\?result\.uncertainColourProductIds:\[\]\)\]\)/);
  assert.match(adminSource, /review\.textContent=String\(reviewIds\.size\)/);
  assert.match(adminSource, /if\(needsOccasion&&!occasion\?\.confident\)\{occasionUncertain\+\+;if\(!uncertainProductIds\.includes\(candidate\.id\)\)uncertainProductIds\.push\(candidate\.id\);if\(!uncertainOccasionProductIds\.includes\(candidate\.id\)\)uncertainOccasionProductIds\.push\(candidate\.id\);\}/);
  assert.match(adminSource, /uncertain colour predictions/);
  assert.match(adminSource, /low-confidence occasion predictions/);
  assert.match(adminSource, /Their highest-scoring occasion\(s\) were saved automatically/);
  assert.match(adminSource, /Processing failures:/);
});

test("ambiguous catalogue writes are re-read before reporting an unknown outcome", () => {
  assert.match(adminSource, /Save outcome unknown/);
  assert.match(adminSource, /const recovery=await githubReadJsonFresh\("data\/products\.json"\)/);
  assert.match(adminSource, /persisted\.image===current\.image/);
});

test("Enrichment candidate selection and field counts share one eligibility decision", () => {
  assert.match(adminSource, /function ssvEnrichFieldNeeds\(product\)/);
  assert.match(adminSource, /function ssvRefreshEnrichFinderCounts\(items=products\)/);
  assert.match(adminSource, /const counts=ssvEnrichMissingCounts\(Array\.isArray\(items\)\?items:products\)/);
  assert.match(adminSource, /const category=normalizeCategoryName\(product\?\.category\)/);
  assert.match(adminSource, /occasion:eligible&&ssvHasNoOccasionMetadata\(product\)&&!ssvHasOccasionDecision\(product\)/);
  assert.match(adminSource, /products:needs\.filter\(item=>item\.occasion\|\|item\.colour\)\.length/);
  assert.match(adminSource, /ssvEnrichFieldNeeds\(p\)\.occasion\|\|ssvEnrichFieldNeeds\(p\)\.colour/);
  assert.match(adminSource, /const initial=await githubReadJsonFresh\("data\/products\.json"\)/);
  assert.match(adminSource, /ssvRefreshEnrichFinderCounts\(initial\.value\)/);
  assert.match(adminSource, /const module=queue\.length\?await import\("\.\/saree-occasion-ai\.js"\):null/);
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


test("occasion enrichment always saves highest-scoring matches, including low-confidence ties", () => {
  assert.match(aiSource, /OCCASION_TIE_TOLERANCE = 0\.0005/);
  assert.match(aiSource, /const nextDistinct = ranked\.find/);
  assert.match(aiSource, /const labels = Array\.isArray\(result\?\.labels\)/);
  assert.match(adminSource, /occasionLabels=\[\.\.\.new Set/);
  assert.match(adminSource, /const addOccasion=needsOccasion&&occasionLabels\.length>0/);
  assert.doesNotMatch(adminSource, /const addOccasion=needsOccasion&&!!occasion\?\.confident/);
  assert.match(adminSource, /if\(needsOccasion&&!occasion\?\.confident\)\{occasionUncertain\+\+;if\(!uncertainProductIds\.includes\(candidate\.id\)\)uncertainProductIds\.push\(candidate\.id\);if\(!uncertainOccasionProductIds\.includes\(candidate\.id\)\)uncertainOccasionProductIds\.push\(candidate\.id\);\}/);
  assert.match(adminSource, /next\.occasions=occasionLabels/);
  assert.match(adminSource, /occasionLabels\.every/);
  assert.match(adminSource, /SSV_OCCASION_LABELS\.has\(value\)/);
  assert.match(adminSource, /async function ssvRenderEnrichManualReview\(result\)/);
  assert.match(adminSource, /Select correct occasions \(select all that apply\)/);
  assert.match(adminSource, /SAVE CORRECTIONS/);
});

test("automatic multi-occasion save preserves product fields and verifies all tied occasions", () => {
  assert.match(adminSource, /const next=\{\.\.\.current\}/);
  assert.match(adminSource, /next\.occasions=occasionLabels/);
  assert.match(adminSource, /await githubWriteJson\("data\/products\.json"/);
  assert.match(adminSource, /occasionLabels\.every/);
  assert.match(adminSource, /SSV_OCCASION_LABELS\.has\(value\)/);
  assert.match(adminSource, /persisted\?\.occasionMetadata\?\.image===String\(current\.image\)/);
});


test("low-confidence occasions are tracked and exposed for manual correction", () => {
  assert.match(adminSource, /if\(needsOccasion&&!occasion\?\.confident\)\{occasionUncertain\+\+;if\(!uncertainProductIds\.includes\(candidate\.id\)\)uncertainProductIds\.push\(candidate\.id\);if\(!uncertainOccasionProductIds\.includes\(candidate\.id\)\)uncertainOccasionProductIds\.push\(candidate\.id\);\}/);
  assert.match(adminSource, /const addOccasion=needsOccasion&&occasionLabels\.length>0/);
  assert.match(adminSource, /low-confidence occasion predictions/);
  assert.doesNotMatch(adminSource, /SAVE SELECTED OCCASIONS/);
  assert.doesNotMatch(adminSource, /reviewSuggestions\.push\(\{id:candidate\.id,name:/);
});

 
test("manual Enrich Finder review controls exist and save corrections safely", () => {
  assert.match(adminSource, /ssvSaveEnrichManualReview/);
  assert.match(adminSource, /Select correct colour/);
  assert.match(adminSource, /Select correct occasions \(select all that apply\)/);
  assert.match(adminSource, /SAVE CORRECTIONS/);
  assert.match(adminSource, /Save verification failed/);
  assert.match(adminSource, /Existing manually maintained occasion tags were preserved/);
});

test("manual review requires every uncertain field and refreshes Needs Review after verified save", () => {
  assert.match(adminSource, /if\(needsColour&&!selectedColour\)throw new Error/);
  assert.match(adminSource, /if\(needsOccasion&&!updateOccasion\)throw new Error/);
  assert.match(adminSource, /Existing manually maintained occasion tags were preserved/);
  assert.match(adminSource, /result\.uncertainColourProductIds=.*filter/);
  assert.match(adminSource, /result\.uncertainOccasionProductIds=.*filter/);
  assert.match(adminSource, /const reviewCount=new Set\(\[\.\.\.result\.uncertainProductIds,\.\.\.result\.uncertainColourProductIds\]\)\.size/);
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


test("Enrich Finder keeps automated inference and provides manual review only for uncertain fields", () => {
  assert.match(aiSource, /MAX_INFERENCE_PASSES = 3/);
  assert.match(adminSource, /const addColour=needsColour&&\(isJewellery\|\|\(colour\?\.confident===true&&SSV_FINDER_COLOURS\.has\(colour\?\.label\)\)\)/);
  assert.match(adminSource, /uncertainColourProductIds/);
  assert.match(adminSource, /uncertainOccasionProductIds/);
  assert.match(adminSource, /ssvRenderEnrichManualReview\(result\)/);
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


const budgetFriendlyStart = source.indexOf("  function ensureBudgetFriendlyInTopThree(");
const budgetFriendlyEnd = source.indexOf("\n  // Customer-side image inference is intentionally disabled.", budgetFriendlyStart);
assert.ok(budgetFriendlyStart >= 0 && budgetFriendlyEnd > budgetFriendlyStart, "Budget-friendly top-three helper must be present");
const ensureBudgetFriendlyInTopThree = new Function(source.slice(budgetFriendlyStart, budgetFriendlyEnd) + "\nreturn ensureBudgetFriendlyInTopThree;")();

test("the cheapest eligible match is included in the top three without replacing TOP PICK", () => {
  const ranked = [
    { id: 1, price: 4000 },
    { id: 2, price: 3500 },
    { id: 3, price: 3000 },
    { id: 4, price: 500 },
    { id: 5, price: 2500 }
  ];
  const result = ensureBudgetFriendlyInTopThree(ranked);
  assert.deepEqual(result.slice(0, 3).map(product => product.id), [1, 2, 4]);
  assert.equal(result[0].id, 1);
  assert.deepEqual(result.map(product => product.id).sort(), [1, 2, 3, 4, 5]);
});

test("top-three ordering stays unchanged when the cheapest match is already included", () => {
  const ranked = [
    { id: 1, price: 1000 },
    { id: 2, price: 500 },
    { id: 3, price: 1500 },
    { id: 4, price: 2000 }
  ];
  assert.deepEqual(ensureBudgetFriendlyInTopThree(ranked).map(product => product.id), [1, 2, 3, 4]);
});

test("small result sets remain unchanged and do not invent a budget-friendly option", () => {
  const ranked = [{ id: 1, price: 1000 }, { id: 2, price: 2000 }, { id: 3, price: 3000 }];
  assert.deepEqual(ensureBudgetFriendlyInTopThree(ranked), ranked);
  assert.deepEqual(ensureBudgetFriendlyInTopThree([]), []);
});

test("Enrich Finder progress and failure details never expose product IDs", () => {
  assert.match(adminSource, /paint\(summary\+\(failures\.length\?\" Details: \"\+failures\.map\(item=>item\.reason\)/);
  assert.doesNotMatch(adminSource, /failures\.map\(item=>\"Product \"\+item\.id/);
  assert.match(adminSource, /console\.error\(\"Finder enrichment failed for product \"\+candidate\.id/);
});

test("Enrich Finder exposes manual colour and occasion controls for uncertain metadata", () => {
  assert.match(adminSource, /async function ssvRenderEnrichManualReview\(result\)/);
  assert.match(adminSource, /Select correct colour/);
  assert.match(adminSource, /Select correct occasions \\(select all that apply\\)/);
  assert.match(adminSource, /SAVE CORRECTIONS/);
  assert.match(adminSource, /ssvSaveEnrichManualReview/);
  assert.match(adminSource, /Save verification failed/);
  assert.match(adminSource, /Existing manually maintained occasion tags were preserved/);
  assert.match(adminSource, /uncertainOccasionProductIds/);
});

test("manual Enrich Finder saves validate allowed metadata and verify persisted GitHub values", () => {
  assert.match(adminSource, /if\(!selectedColour&&!updateOccasion\)throw new Error/);
  assert.match(adminSource, /if\(selectedColour&&!SSV_FINDER_COLOURS\.has\(selectedColour\)\)/);
  assert.match(adminSource, /saved\.colourMetadata\?\.source!==\"manual-reviewed\"/);
  assert.match(adminSource, /saved\.occasionMetadata\?\.source!==\"ai-reviewed\"/);
  assert.match(adminSource, /current\?\.occasionMetadata\?\.source===\"ai\"/);
});
