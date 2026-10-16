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

// A lightweight pixel signal complements CLIP for colour names that CLIP often confuses
// (notably navy fabric with gold/beige embroidery). It is advisory and never overrides
// the model unless the image has a clear dominant chromatic fabric colour.
function pixelColourFromRgb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.24 || lightness < 0.09 || lightness > 0.88) return null;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  if (hue >= 195 && hue <= 255) return "Blue";
  if (hue >= 95 && hue < 165) return "Green";
  if (hue >= 165 && hue < 195) return "Blue";
  if (hue >= 255 && hue < 290) return "Purple";
  if (hue >= 290 && hue < 345) return "Pink";
  if (hue >= 345 || hue < 12) return "Red";
  if (hue >= 12 && hue < 28) return "Orange";
  if (hue >= 28 && hue < 58) return lightness > 0.55 ? "Gold" : "Brown";
  if (hue >= 58 && hue < 95) return "Yellow";
  return null;
}

export function selectDominantPixelColour(rgbPixels) {
  const counts = new Map();
  for (const pixel of Array.isArray(rgbPixels) ? rgbPixels : []) {
    if (!Array.isArray(pixel) || pixel.length < 3 || !pixel.slice(0, 3).every(value => Number.isFinite(Number(value)))) continue;
    const label = pixelColourFromRgb(Number(pixel[0]), Number(pixel[1]), Number(pixel[2]));
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  }
  const ranked = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || COLOURS.indexOf(a.label) - COLOURS.indexOf(b.label));
  if (!ranked.length || ranked[0].count < 12) return null;
  const runnerUp = ranked[1]?.count || 0;
  if (ranked[0].count / Math.max(1, runnerUp) < 1.25) return null;
  return { label: ranked[0].label, share: ranked[0].count / ranked.reduce((sum, item) => sum + item.count, 0), margin: (ranked[0].count - runnerUp) / ranked.reduce((sum, item) => sum + item.count, 0), counts: ranked };
}

async function readDominantPixelColour(url) {
  try {
    if (typeof Image === "undefined" || typeof document === "undefined") return null;
    const image = new Image();
    image.decoding = "async";
    // Product images are served from the shop's own GitHub Pages origin. If canvas
    // access is blocked by a host/CORS configuration, fall back safely to CLIP.
    image.src = url;
    if (typeof image.decode === "function") await image.decode();
    else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    if (!image.naturalWidth || !image.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    const width = 72, height = Math.max(72, Math.round(72 * image.naturalHeight / image.naturalWidth));
    canvas.width = width; canvas.height = Math.min(height, 128);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    // Focus on the centre of the product photo, reducing border/background influence.
    const cropWidth = image.naturalWidth * 0.68, cropHeight = image.naturalHeight * 0.72;
    context.drawImage(image, (image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = [];
    for (let i = 0; i < data.length; i += 16) pixels.push([data[i], data[i + 1], data[i + 2]]);
    return selectDominantPixelColour(pixels);
  } catch (_) {
    return null;
  }
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

function strongestPass(results, isConfident) {
  // Compare complete per-pass rankings, never average scores from different prompts.
  // Prefer a confident result, then the clearest top-vs-runner-up separation, then
  // the top score. Strict comparisons preserve the earliest pass on exact ties.
  let best = null;
  for (const result of results) {
    if (!best) { best = result; continue; }
    const candidateConfidence = isConfident(result) ? 1 : 0;
    const bestConfidence = isConfident(best) ? 1 : 0;
    if (candidateConfidence > bestConfidence ||
        (candidateConfidence === bestConfidence && result.margin > best.margin) ||
        (candidateConfidence === bestConfidence && result.margin === best.margin && result.score > best.score)) {
      best = result;
    }
  }
  return best;
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

      const occasionResults = [], colourResults = [];
      let occasion = null;
      let colour = null;
      let colourError = null;
      let passes = 0;
      for (let pass = 0; pass < MAX_INFERENCE_PASSES; pass++) {
        passes = pass + 1;
        const currentOccasionPrompts = occasionPrompts(itemType, pass);
        // Runtime/image/model errors deliberately propagate to Admin diagnostics.
        const predictions = await classifier(url, currentOccasionPrompts);
        const occasionScores = scoresByPrompt(predictions, currentOccasionPrompts)
          .map((item, index) => ({ label: LABELS[index].label, score: item.score }))
          .filter(item => Number.isFinite(item.score))
          .sort((a, b) => b.score - a.score || LABELS.findIndex(label => label.label === a.label) - LABELS.findIndex(label => label.label === b.label));
        if (!occasionScores.length) throw new Error("The image model returned no valid occasion predictions.");
        const passOccasion = occasionResult(occasionScores);
        passOccasion.confident = isConfidentOccasionPrediction(passOccasion);
        occasionResults.push(passOccasion);
        occasion = strongestPass(occasionResults, isConfidentOccasionPrediction);

        // Keep colour inference independent: a colour-model failure must not
        // erase a usable occasion prediction. Retry colour on later bounded passes.
        try {
          const currentColourPrompts = colourPrompts(itemType, pass);
          const colourPredictions = await classifier(url, currentColourPrompts);
          const colourScores = scoresByPrompt(colourPredictions, currentColourPrompts)
            .map((item, index) => ({ label: COLOURS[index], score: item.score }))
            .filter(item => Number.isFinite(item.score))
            .sort((a, b) => b.score - a.score || COLOURS.indexOf(a.label) - COLOURS.indexOf(b.label));
          const passColour = colourResult(colourScores);
          passColour.confident = isConfidentColourPrediction(passColour);
          colourResults.push(passColour);
          colour = strongestPass(colourResults, isConfidentColourPrediction);
          colourError = null;
        } catch (error) {
          colourError = error;
        }
        if (occasion.confident && colour?.confident) break;
      }

      // When CLIP's label conflicts with a strong, central-image pixel majority,
      // use the visual signal to prevent embroidery/background tones winning over
      // the dominant garment fabric. Low-signal images remain governed by CLIP.
      const pixelColour = await readDominantPixelColour(url);
      if (pixelColour && colour && pixelColour.label !== colour.label && pixelColour.share >= 0.42 && pixelColour.margin >= 0.12) {
        colour = { ...colour, label: pixelColour.label, pixelEvidence: pixelColour, confident: Boolean(colour.confident || pixelColour.share >= 0.55) };
      } else if (pixelColour && colour && pixelColour.label === colour.label) {
        colour = { ...colour, pixelEvidence: pixelColour, confident: Boolean(colour.confident || (pixelColour.share >= 0.42 && pixelColour.margin >= 0.12)) };
      }
      const combined = { occasion, colour, colourError, pixelColour };
      combined.passes = passes;
      combined.colourConfident = Boolean(colour && isConfidentColourPrediction(colour));
      // Cache only complete confident results. Transient failures and uncertain
      // predictions remain retryable, and Admin can report real failures.
      if (occasion.confident && colour?.confident) resultCache.set(cacheKey, combined);
      return combined;
    }
  };
}

export function selectOccasionPrediction(predictions, itemType = "saree") {
  if (!Array.isArray(predictions) || !predictions.length) throw new Error("The image model returned no predictions.");
  const labelByPrompt = new Map(LABELS.map(item => ["a " + itemType + " " + item.description, item.label]));
  const valid = predictions.filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)));
  if (!valid.length) throw new Error("The image model returned invalid predictions.");
  const ranked = valid
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
  const valid = predictions.filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)));
  if (!valid.length) throw new Error("The image model returned invalid colour predictions.");
  const normalized = valid
    .map(item => ({ ...item, colour: COLOURS.find(colour => item.label.toLowerCase().includes("colour is " + colour.toLowerCase())) || "" }))
    .filter(item => item.colour)
    .map(item => ({ label: item.colour, score: Number(item.score) }))
    .sort((a, b) => b.score - a.score || COLOURS.indexOf(a.label) - COLOURS.indexOf(b.label));
  return colourResult(normalized);
}

export function isConfidentColourPrediction(result) {
  // A plausible label is not sufficient evidence to mutate catalogue metadata.
  // Keep uncertain predictions retryable and leave the colour field untouched.
  return Boolean(result && COLOURS.includes(result.label) && Number.isFinite(result.score) &&
    result.score >= 0.40 && Number.isFinite(result.margin) && result.margin >= 0.30);
}
