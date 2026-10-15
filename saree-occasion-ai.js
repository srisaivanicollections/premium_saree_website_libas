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
let pipelinePromise;
const resultCache = new Map();

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2")
      .then(({ pipeline, env }) => {
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        // uint8 avoids the ConvInteger path that fails in some browser WASM runtimes.
        return pipeline("zero-shot-image-classification", MODEL_ID, {
          device: "wasm",
          dtype: "uint8"
        });
      })
      .catch(error => {
        pipelinePromise = undefined;
        throw error;
      });
  }
  return pipelinePromise;
}

function imageUrl(path) {
  const value = String(path || "").trim();
  if (!value) throw new Error("Product image is missing.");
  const url = new URL(value.replace(/^\.\//, ""), document.baseURI);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Unsupported product image URL.");
  }
  return url.href;
}

export async function createOccasionScanner() {
  const classifier = await getPipeline();
  return {
    async classify(path, category = "Sarees", options = {}) {
      const url = imageUrl(path);
      const normalizedCategory = String(category || "Sarees").trim().toLowerCase();
      const itemType = ["jewellery", "jewelry"].includes(normalizedCategory)
        ? "piece of jewellery"
        : normalizedCategory === "dresses" ? "dress" : "saree";
      const cacheKey = url + "|" + itemType;
      if (!options.retry && resultCache.has(cacheKey)) return resultCache.get(cacheKey);

      // Runtime/image/model errors deliberately propagate to Admin diagnostics.
      // Only valid predictions below the confidence threshold are "uncertain".
      const predictions = await classifier(url, LABELS.map(item => "a " + itemType + " " + item.description));
      const occasion = selectOccasionPrediction(predictions, itemType);
      occasion.confident = isConfidentOccasionPrediction(occasion);

      const colourPredictions = await classifier(url, COLOURS.map(value =>
        "a product photo of a " + itemType + " whose main visible fabric or material colour is " + value.toLowerCase()
      ));
      const colour = selectColourPrediction(colourPredictions);
      colour.confident = isConfidentColourPrediction(colour);

      const combined = { occasion, colour };
      // Do not poison retries with transient failures or uncertain predictions.
      if (occasion.confident && colour.confident) resultCache.set(cacheKey, combined);
      return combined;
    }
  };
}

/**
 * Pure prediction normalization, exported so confidence and malformed-output
 * handling can be tested without downloading the browser model.
 */
export function selectOccasionPrediction(predictions, itemType = "saree") {
  if (!Array.isArray(predictions) || !predictions.length) {
    throw new Error("The image model returned no predictions.");
  }
  const labelByPrompt = new Map(LABELS.map(item => ["a " + itemType + " " + item.description, item.label]));
  const sorted = predictions
    .filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
    .sort((a, b) => Number(b.score) - Number(a.score));
  if (!sorted.length) throw new Error("The image model returned invalid predictions.");
  const ranked = sorted
    .map((item, index) => ({
      label: labelByPrompt.get(item.label) || "",
      score: Number(item.score),
      margin: Number(item.score) - Number(sorted[index + 1]?.score || 0),
      rank: index + 1
    }))
    .filter(item => item.label);
  if (!ranked.length) throw new Error("The image model returned no known occasion labels.");
  const best = ranked[0];
  return { label: best.label, score: best.score, margin: best.margin, rankings: ranked };
}

export function isConfidentOccasionPrediction(result) {
  return Boolean(result &&
    LABELS.some(item => item.label === result.label) &&
    Number.isFinite(result.score) && result.score >= 0.30 &&
    Number.isFinite(result.margin) && result.margin >= 0.07);
}

export function selectColourPrediction(predictions) {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no colour predictions.");
  const normalized = predictions.filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
    .map(item => ({ ...item, colour: COLOURS.find(colour => item.label.toLowerCase().includes("colour is " + colour.toLowerCase())) || "" }))
    .sort((a, b) => Number(b.score) - Number(a.score));
  if (!normalized.length) throw new Error("The image model returned invalid colour predictions.");
  const best = normalized[0];
  return { label: best.colour, score: Number(best.score), margin: Number(best.score) - Number(normalized[1]?.score || 0) };
}

export function isConfidentColourPrediction(result) {
  // CLIP colour scores can be confidently wrong on printed/multicolour garments.
  // Use a conservative auto-save gate: ambiguous predictions remain for manual review.
  return Boolean(result && COLOURS.includes(result.label) && Number.isFinite(result.score) &&
    result.score >= 0.40 && Number.isFinite(result.margin) && result.margin >= 0.30);
}
