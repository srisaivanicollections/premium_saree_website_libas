/*
 * Free, deterministic, client-side occasion and colour inference.
 * Uses the existing public ONNX CLIP model/runtime. No paid endpoint or upload.
 */
const MODEL_ID = "onnx-community/CLIP-ViT-B-32-laion2B-s34B-b79K-ONNX";
const LABELS = [
  { label: "daily wear", description: "intended for everyday daily wear, simple and comfortable" },
  { label: "wedding", description: "intended for wedding wear, bridal wear or a wedding guest" },
  { label: "festive", description: "intended for festive celebrations or festival wear" },
  { label: "party wear", description: "intended for party wear, evening events or cocktail occasions" },
  { label: "traditional", description: "intended for traditional cultural or religious occasions" }
];
const COLOURS = ["Black","Blue","Brown","Gold","Green","Grey","Ivory","Maroon","Multi-colour","Orange","Pink","Purple","Red","Silver","White","Yellow"];
const MAX_PASSES = 3;
const OCCASION_TIE_TOLERANCE = 0.0005;
let pipelinePromise;
const resultCache = new Map();

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2")
      .then(({ pipeline, env }) => {
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        return pipeline("zero-shot-image-classification", MODEL_ID, { device: "wasm", dtype: "uint8" });
      })
      .catch(error => { pipelinePromise = undefined; throw error; });
  }
  return pipelinePromise;
}
function imageUrl(path) {
  const value = String(path || "").trim();
  if (!value) throw new Error("Product image is missing.");
  const url = new URL(value.replace(/^\.\//, ""), document.baseURI);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported product image URL.");
  return url.href;
}
function normalizeCategory(category) {
  const value = String(category || "Sarees").trim().toLowerCase();
  return ["jewellery", "jewelry"].includes(value) ? "piece of jewellery" : value === "dresses" ? "dress" : "saree";
}
function scoreMap(predictions, labelForPrompt) {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no predictions.");
  const result = new Map();
  for (const item of predictions) {
    if (!item || typeof item.label !== "string" || !Number.isFinite(Number(item.score))) continue;
    const label = labelForPrompt.get(item.label);
    if (label && (!result.has(label) || Number(item.score) > result.get(label))) result.set(label, Number(item.score));
  }
  if (!result.size) throw new Error("The image model returned no known labels.");
  return result;
}
function aggregateScores(passMaps, labels) {
  // Fixed weights and stable label order make repeated runs reproducible.
  // Later prompts contribute evidence, but cannot replace the first pass outright.
  const weights = [0.5, 0.3, 0.2].slice(0, passMaps.length);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  return labels.map((label, index) => ({
    label,
    score: passMaps.reduce((sum, scores, passIndex) => sum + weights[passIndex] * (scores.get(label) || 0), 0) / weightTotal,
    stableIndex: index
  })).sort((a, b) => b.score - a.score || a.stableIndex - b.stableIndex);
}
function chooseTop(scores, tolerance = OCCASION_TIE_TOLERANCE) {
  if (!scores.length) throw new Error("No valid model labels were available.");
  const best = scores[0];
  const tied = scores.filter(item => best.score - item.score <= tolerance);
  const nextDistinct = scores.find(item => best.score - item.score > tolerance);
  return { best, tied, margin: best.score - (nextDistinct?.score || 0) };
}
function isReliable(top, minScore, minMargin) {
  return top.best.score >= minScore && top.margin >= minMargin;
}
async function inferCategory(classifier, url, itemType) {
  const labelForPrompt = new Map();
  const promptSets = [
    LABELS.map(item => ["a " + itemType + " " + item.description, item.label]),
    LABELS.map(item => ["a clear catalogue photograph showing a " + itemType + " suitable for " + item.label + " use", item.label]),
    LABELS.map(item => ["based on visible design, fabric, embellishment and styling, this " + itemType + " is most suitable for " + item.label, item.label])
  ];
  const passMaps = [];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const prompts = promptSets[pass];
    const mapping = new Map(prompts.map(([prompt, label]) => [prompt, label]));
    const predictions = await classifier(url, prompts.map(([prompt]) => prompt));
    passMaps.push(scoreMap(predictions, mapping));
    const ranked = aggregateScores(passMaps, LABELS.map(item => item.label));
    const top = chooseTop(ranked);
    if (isReliable(top, 0.30, 0.07)) break;
  }
  const rankings = aggregateScores(passMaps, LABELS.map(item => item.label));
  const top = chooseTop(rankings);
  return {
    label: top.tied[0].label,
    labels: top.tied.map(item => item.label),
    score: top.best.score,
    margin: top.margin,
    rankings: rankings.map((item, index) => ({ label: item.label, score: item.score, rank: index + 1 })),
    passes: passMaps.length,
    confident: isReliable(top, 0.30, 0.07)
  };
}
async function inferColour(classifier, url, itemType) {
  const promptSets = [
    COLOURS.map(colour => ["a product photo of a " + itemType + " whose dominant visible product material colour is " + colour.toLowerCase(), colour]),
    COLOURS.map(colour => ["the main body of the " + itemType + " itself is " + colour.toLowerCase() + " in this catalogue photograph, ignoring background and small trim", colour]),
    COLOURS.map(colour => ["looking only at the largest visible area of the actual " + itemType + ", its dominant colour is " + colour.toLowerCase(), colour])
  ];
  const passMaps = [];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const prompts = promptSets[pass];
    const mapping = new Map(prompts.map(([prompt, colour]) => [prompt, colour]));
    const predictions = await classifier(url, prompts.map(([prompt]) => prompt));
    passMaps.push(scoreMap(predictions, mapping));
    const ranked = aggregateScores(passMaps, COLOURS);
    const top = chooseTop(ranked, 0.000001);
    if (isReliable(top, 0.40, 0.30)) break;
  }
  const rankings = aggregateScores(passMaps, COLOURS);
  const top = chooseTop(rankings, 0.000001);
  return {
    label: top.best.label,
    score: top.best.score,
    margin: top.margin,
    rankings: rankings.map((item, index) => ({ label: item.label, score: item.score, rank: index + 1 })),
    passes: passMaps.length,
    confident: isReliable(top, 0.40, 0.30)
  };
}

export async function createOccasionScanner() {
  const classifier = await getPipeline();
  return {
    async classify(path, category = "Sarees", options = {}) {
      const url = imageUrl(path);
      const itemType = normalizeCategory(category);
      const cacheKey = url + "|" + itemType + "|" + MODEL_ID;
      if (!options.retry && resultCache.has(cacheKey)) return resultCache.get(cacheKey);
      // Keep occasion and colour independent: a failure in one must not invent the other.
      const [occasionResult, colourResult] = await Promise.allSettled([
        inferCategory(classifier, url, itemType),
        inferColour(classifier, url, itemType)
      ]);
      if (occasionResult.status === "rejected" && colourResult.status === "rejected") {
        throw new Error("Occasion and colour inference failed: " + String(occasionResult.reason?.message || occasionResult.reason) + "; " + String(colourResult.reason?.message || colourResult.reason));
      }
      const combined = {
        occasion: occasionResult.status === "fulfilled" ? occasionResult.value : null,
        occasionError: occasionResult.status === "rejected" ? occasionResult.reason : null,
        colour: colourResult.status === "fulfilled" ? colourResult.value : null,
        colourError: colourResult.status === "rejected" ? colourResult.reason : null
      };
      if (combined.occasion && combined.colour) resultCache.set(cacheKey, combined);
      return combined;
    }
  };
}

/** Pure helpers exported for unit tests. */
export function selectOccasionPrediction(predictions, itemType = "saree") {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no predictions.");
  const labelByPrompt = new Map(LABELS.map(item => ["a " + itemType + " " + item.description, item.label]));
  const scores = scoreMap(predictions, labelByPrompt);
  const ranked = [...scores].map(([label, score], stableIndex) => ({ label, score, stableIndex }))
    .sort((a, b) => b.score - a.score || a.stableIndex - b.stableIndex);
  const top = chooseTop(ranked);
  return { label: top.tied[0].label, labels: top.tied.map(item => item.label), score: top.best.score, margin: top.margin,
    rankings: ranked.map((item, index) => ({ label: item.label, score: item.score, rank: index + 1 })) };
}
export function isConfidentOccasionPrediction(result) {
  const labels = Array.isArray(result?.labels) && result.labels.length ? result.labels : [result?.label];
  return Boolean(result && labels.every(label => LABELS.some(item => item.label === label)) &&
    Number.isFinite(result.score) && result.score >= 0.30 && Number.isFinite(result.margin) && result.margin >= 0.07);
}
export function selectColourPrediction(predictions) {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no colour predictions.");
  const normalized = predictions.filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
    .map(item => ({ ...item, colour: COLOURS.find(colour => item.label.toLowerCase().includes("colour is " + colour.toLowerCase())) || "" }))
    .filter(item => item.colour)
    .sort((a, b) => Number(b.score) - Number(a.score) || COLOURS.indexOf(a.colour) - COLOURS.indexOf(b.colour));
  if (!normalized.length) throw new Error("The image model returned no known colour labels.");
  const best = normalized[0];
  return { label: best.colour, score: Number(best.score), margin: Number(best.score) - Number(normalized[1]?.score || 0),
    rankings: normalized.map((item, index) => ({ label: item.colour, score: Number(item.score), rank: index + 1 })) };
}
export function isConfidentColourPrediction(result) {
  return Boolean(result && COLOURS.includes(result.label) && Number.isFinite(result.score) &&
    result.score >= 0.40 && Number.isFinite(result.margin) && result.margin >= 0.30);
}
export const __test = Object.freeze({ MAX_PASSES, OCCASION_TIE_TOLERANCE, COLOURS, LABELS });
