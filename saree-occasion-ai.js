/*
 * Free, client-side occasion inference for Smart Saree Finder.
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


const VISUAL_COLORS=["Black","Blue","Brown","Gold","Green","Grey","Multicolor","Orange","Pink","Purple","Red","Silver","White","Yellow","Beige","Cream","Maroon","Peach","Teal"];
const VISUAL_PATTERNS=["Plain","Floral","Geometric","Striped","Checked","Paisley","Traditional Motif","Embroidered","Woven","Printed","Sequin/Stone Work","Unknown"];
async function bestLabel(classifier,url,itemType,descriptions,minimumScore,minimumMargin){
  const prompts=descriptions.map(description=>"a "+itemType+" "+description.toLowerCase());
  const predictions=await classifier(url,prompts);
  const sorted=(Array.isArray(predictions)?predictions:[]).filter(item=>item&&typeof item.label==="string"&&Number.isFinite(Number(item.score))).sort((a,b)=>Number(b.score)-Number(a.score));
  if(!sorted.length)return null;
  const best=sorted[0],margin=Number(best.score)-Number(sorted[1]?.score||0);
  if(Number(best.score)<minimumScore||margin<minimumMargin)return null;
  const index=prompts.indexOf(best.label);return index>=0?{index,score:Number(best.score),margin}:null;
}

export async function createOccasionScanner() {
  const classifier = await getPipeline();
  return {
    async classify(path, category = "Sarees") {
      const url = imageUrl(path);
      const normalizedCategory = String(category || "Sarees").trim().toLowerCase();
      const itemType = ["jewellery", "jewelry"].includes(normalizedCategory)
        ? "piece of jewellery"
        : normalizedCategory === "dresses" ? "dress" : "saree";
      const cacheKey = url + "|" + itemType;
      if (resultCache.has(cacheKey)) return resultCache.get(cacheKey);
      const candidates = LABELS.map(item => "a " + itemType + " " + item.description);
      const predictions = await classifier(url, candidates);
      if (!Array.isArray(predictions) || !predictions.length) {
        throw new Error("The image model returned no predictions.");
      }
      const labelByPrompt = new Map(LABELS.map(item => ["a " + itemType + " " + item.description, item.label]));
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
      resultCache.set(cacheKey, result);
      return result;
    },
    async classifyVisualAttributes(path, category = "Sarees") {
      const url=imageUrl(path),normalizedCategory=String(category||"Sarees").trim().toLowerCase();
      const itemType=["jewellery","jewelry"].includes(normalizedCategory)?"piece of jewellery":normalizedCategory==="dresses"?"dress":"saree";
      const classifier=await getPipeline();
      const occasionPrompts=["intended for everyday daily wear, simple and comfortable","intended for wedding wear, bridal wear or a wedding guest","intended for festive celebrations or festival wear","intended for party wear, evening events or cocktail occasions","intended for traditional cultural or religious occasions"];
      // Keep inference sequential to avoid concurrent WASM session pressure on phones.
      const occasion=await bestLabel(classifier,url,itemType,occasionPrompts,0.24,0.035);
      const color=await bestLabel(classifier,url,itemType,VISUAL_COLORS.map(value=>"predominantly "+value+" in colour"),0.075,0.012);
      const pattern=await bestLabel(classifier,url,itemType,VISUAL_PATTERNS.map(value=>value==="Unknown"?"with no clearly identifiable pattern":"with a "+value+" pattern or surface treatment"),0.10,0.015);
      const occasionValues=["Daily Wear","Wedding","Festive","Party Wear","Traditional"];
      const mappedOccasion=occasion&&occasion.index>=0?[occasionValues[occasion.index]]:[];
      const colorValue=color&&color.index>=0?VISUAL_COLORS[color.index]:"";
      const patternValue=pattern&&pattern.index>=0?VISUAL_PATTERNS[pattern.index]:"";
      const confidenceParts=[occasion?.score,color?.score,pattern?.score].filter(Number.isFinite);
      const description=[colorValue?colorValue+"-toned":"",itemType,patternValue&&patternValue!=="Unknown"?"with "+patternValue.toLowerCase()+" detailing":""].filter(Boolean).join(" ").slice(0,180);
      return {occasions:mappedOccasion,color:colorValue,pattern:patternValue,description:description||"",confidence:confidenceParts.length?Number((confidenceParts.reduce((a,b)=>a+b,0)/confidenceParts.length).toFixed(3)):0};
    }
  };
}
