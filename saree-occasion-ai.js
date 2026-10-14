/*
 * Free, client-side occasion inference for Smart Saree Finder.
 * No API key, paid inference endpoint, backend, or image upload is used.
 * The model and runtime are downloaded from public CDN/model hosting on first use.
 * Selected ONNX model card declares MIT; re-check model card before future upgrades.
 */
const MODEL_ID = "onnx-community/CLIP-ViT-B-32-laion2B-s34B-b79K-ONNX";
const LABELS = [
  { label: "daily wear", prompt: "a saree intended for everyday daily wear, simple and comfortable" },
  { label: "wedding", prompt: "a saree intended for wedding wear, bridal wear or a wedding guest" },
  { label: "festive", prompt: "a saree intended for festive celebrations or festival wear" },
  { label: "party wear", prompt: "a saree intended for party wear, evening events or cocktail occasions" },
  { label: "traditional", prompt: "a saree intended for traditional cultural or religious occasions" }
];
let pipelinePromise;
const resultCache = new Map();

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2")
      .then(({ pipeline, env }) => {
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        // Transformers.js uses browser-managed caching for model assets where available.
        return pipeline("zero-shot-image-classification", MODEL_ID, {
          device: "wasm",
          dtype: "q8"
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
    async classify(path) {
      const url = imageUrl(path);
      if (resultCache.has(url)) return resultCache.get(url);
      const candidates = LABELS.map(item => item.prompt);
      const predictions = await classifier(url, candidates);
      if (!Array.isArray(predictions) || !predictions.length) {
        throw new Error("The image model returned no predictions.");
      }
      const labelByPrompt = new Map(LABELS.map(item => [item.prompt, item.label]));
      const sorted = predictions
        .filter(item => item && typeof item.label === "string" && Number.isFinite(Number(item.score)))
        .sort((a, b) => Number(b.score) - Number(a.score));
      if (!sorted.length) throw new Error("The image model returned invalid predictions.");
      const best = sorted[0];
      const result = {
        label: labelByPrompt.get(best.label) || "",
        score: Number(best.score),
        margin: Number(best.score) - Number(sorted[1]?.score || 0)
      };
      resultCache.set(url, result);
      return result;
    }
  };
}
