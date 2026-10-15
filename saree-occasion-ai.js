/*
 * Free, client-side occasion and colour inference for Smart Saree Finder.
 * No API key, paid inference endpoint, backend, or image upload is used.
 * The model and runtime are downloaded from public CDN/model hosting on first use.
 * Selected ONNX model card declares MIT; re-check model card before future upgrades.
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
const OCCASION_TIE_TOLERANCE = 0.0005;
const MAX_INFERENCE_PASSES = 3;
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

function itemTypeFor(category) {
  const normalized = String(category || "Sarees").trim().toLowerCase();
  if (["jewellery", "jewelry"].includes(normalized)) return "piece of jewellery";
  if (normalized === "dresses") return "dress";
  return "saree";
}

function occasionPrompts(itemType, pass) {
  return LABELS.map(item => {
    if (pass === 1) return "a product photo of a " + itemType + " intended for " + item.label + " wear";
    if (pass === 2) return "based on the garment's style, fabric, embellishment and formality, this " + itemType + " is most suitable for " + item.label;
    return "visual evidence in this " + itemType + " supports the occasion category " + item.label + "; judge the product itself, not the background";
  });
}

function colourPrompts(itemType, pass) {
  return COLOURS.map(value => {
    if (pass === 1) return "a product photo of a " + itemType + " whose main visible fabric or material colour is " + value.toLowerCase();
    if (pass === 2) return "the dominant colour of the actual " + itemType + " fabric or material is " + value.toLowerCase() + ", ignoring the background and lighting";
    return "looking at the largest visible area of the actual " + itemType + ", its dominant product colour is " + value.toLowerCase() + ", not trim, embroidery or accessories";
  });
}

function scoresByPrompt(predictions, prompts) {
  const byPrompt = new Map(prompts.map(prompt => [prompt, null]));
  for (const item of Array.isArray(predictions) ? predictions : []) {
    if (item && byPrompt.has(item.label) && Number.isFinite(Number(item.score))) byPrompt.set(item.label, Number(item.score));
  }
  return prompts.map((prompt, index) => ({ index, score: byPrompt.get(prompt) }));
}

function meanScores(runs, labels) {
  return labels.map((label, index) => {
    const values = runs.map(run => run[index]).filter(Number.isFinite);
    return { label, score: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN };
  }).filter(item => Number.isFinite(item.score)).sort((a, b) => b.score - a.score || labels.indexOf(a.label) - labels.indexOf(b.label));
}

function occasionResult(ranked) {
  if (!ranked.length) throw new Error("The image model returned no known occasion labels.");
  const best = ranked[0];
  const labels = ranked.filter(item => Math.abs(item.score - best.score) <= OCCASION_TIE_TOLERANCE).map(item => item.label);
  const nextDistinct = ranked.find(item => item.score < best.score - OCCASION_TIE_TOLERANCE);
  const margin = best.score - Number(nextDistinct?.score || 0);
  return {
    label: best.label, labels, score: best.score, margin,
    rankings: ranked.map((item, index) => ({ ...item, rank: index + 1, margin: index === 0 ? margin : item.score - Number(ranked[index + 1]?.score || 0) }))
  };
}

export async function createOccasionScanner() {
  const classifier = await getPipeline();
  return {
    async classify(path, category = "Sarees", options = {}) {
      const url = imageUrl(path);
      const itemType = itemTypeFor(category);
      const cacheKey = url + "|" + itemType;
      if (!options.retry && resultCache.has(cacheKey)) return resultCache.get(cacheKey);

      const occasionRuns = [], colourRuns = [];
      let occasion = null, colour = null, passes = 0;
      for (let pass = 0; pass < MAX_INFERENCE_PASSES; pass++) {
        passes = pass + 1;
        const [occasionPredictions, colourPredictions] = await Promise.all([
          classifier(url, occasionPrompts(itemType, pass)),
          classifier(url, colourPrompts(itemType, pass))
        ]);
        const occasionScores = scoresByPrompt(occasionPredictions, occasionPrompts(itemType, pass));
        const colourScores = scoresByPrompt(colourPredictions, colourPrompts(itemType, pass));
        occasionRuns.push(occasionScores.map(item => item.score));
        colourRuns.push(colourScores.map(item => item.score));

        const occasionRanked = meanScores(occasionRuns, LABELS.map(item => item.label));
        occasion = occasionResult(occasionRanked);
        const colourRanked = meanScores(colourRuns, COLOURS);
        colour = colourResult(colourRanked);
        occasion.confident = isConfidentOccasionPrediction(occasion);
        colour.confident = isConfidentColourPrediction(colour);
        if (occasion.confident && colour.confident) break;
      }

      const combined = { occasion: { ...occasion, passes }, colour: { ...colour, passes }, passes };
      // Only cache completed deterministic inference results. Errors propagate so
      // Admin never mistakes a failed model call for a valid empty prediction.
      if (occasion?.labels?.length && COLOURS.includes(colour?.label)) resultCache.set(cacheKey, combined);
      return combined;
    }
  };
}

export function selectOccasionPrediction(predictions, itemType = "saree") {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no predictions.");
  const labelByPrompt = new Map(LABELS.map(item => ["a " + itemType + " " + item.description, item.label]));
  const ranked = predictions
    .filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
    .map(item => ({ label: labelByPrompt.get(item.label) || "", score: Number(item.score) }))
    .filter(item => item.label)
    .sort((a, b) => b.score - a.score || LABELS.findIndex(label => label.label === a.label) - LABELS.findIndex(label => label.label === b.label));
  if (!ranked.length) throw new Error("The image model returned no known occasion labels.");
  return occasionResult(ranked);
}

export function isConfidentOccasionPrediction(result) {
  const labels = Array.isArray(result?.labels) && result.labels.length ? result.labels : [result?.label];
  return Boolean(result &&
    labels.every(label => LABELS.some(item => item.label === label)) &&
    Number.isFinite(result.score) && result.score >= 0.30 &&
    Number.isFinite(result.margin) && result.margin >= 0.07);
}

function colourResult(ranked) {
  if (!ranked.length) throw new Error("The image model returned no known colour labels.");
  const best = ranked[0];
  return { label: best.label, score: best.score, margin: best.score - Number(ranked[1]?.score || 0), rankings: ranked.map((item, index) => ({ ...item, rank: index + 1 })) };
}

export function selectColourPrediction(predictions) {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no colour predictions.");
  const normalized = predictions.filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
    .map(item => ({ ...item, colour: COLOURS.find(colour => item.label.toLowerCase().includes("colour is " + colour.toLowerCase())) || "" }))
    .filter(item => item.colour)
    .map(item => ({ label: item.colour, score: Number(item.score) }))
    .sort((a, b) => b.score - a.score || COLOURS.indexOf(a.label) - COLOURS.indexOf(b.label));
  return colourResult(normalized);
}

export function isConfidentColourPrediction(result) {
  // Confidence affects whether more inference passes are needed, never whether a
  // valid single colour is selected and returned.
  return Boolean(result && COLOURS.includes(result.label) && Number.isFinite(result.score) &&
    result.score >= 0.40 && Number.isFinite(result.margin) && result.margin >= 0.30);
}
