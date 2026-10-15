import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectOccasionPrediction, isConfidentOccasionPrediction, selectColourPrediction, isConfidentColourPrediction, __test } from "../saree-occasion-ai.js";

const prompts = {
  wedding: "a saree intended for wedding wear, bridal wear or a wedding guest",
  festive: "a saree intended for festive celebrations or festival wear",
  daily: "a saree intended for everyday daily wear, simple and comfortable"
};

test("selects the highest valid known occasion prediction", () => {
  const result = selectOccasionPrediction([
    { label: prompts.festive, score: 0.42 },
    { label: prompts.wedding, score: 0.68 },
    { label: prompts.daily, score: 0.21 }
  ]);
  assert.equal(result.label, "wedding");
  assert.equal(result.score, 0.68);
  assert.ok(Math.abs(result.margin - 0.26) < 1e-12, "margin should equal the difference between the top two scores");
  assert.equal(isConfidentOccasionPrediction(result), true);
});

test("returns all tied top occasions and measures confidence against the next distinct score", () => {
  const result = selectOccasionPrediction([
    { label: prompts.festive, score: 0.392 },
    { label: prompts.wedding, score: 0.392 },
    { label: prompts.daily, score: 0.102 },
    { label: "a saree intended for party wear, evening events or cocktail occasions", score: 0.072 }
  ]);
  assert.deepEqual(result.labels, ["wedding", "festive"]);
  assert.equal(result.label, "wedding");
  assert.ok(Math.abs(result.margin - 0.29) < 1e-12);
  assert.equal(isConfidentOccasionPrediction(result), true);
});

test("keeps tied but low-confidence occasions uncertain", () => {
  const result = selectOccasionPrediction([
    { label: prompts.festive, score: 0.292 },
    { label: prompts.wedding, score: 0.292 },
    { label: prompts.daily, score: 0.102 }
  ]);
  assert.deepEqual(result.labels, ["wedding", "festive"]);
  assert.equal(isConfidentOccasionPrediction(result), false);
});

test("rejects a low-confidence prediction", () => {
  assert.equal(isConfidentOccasionPrediction({ label: "wedding", score: 0.29, margin: 0.2 }), false);
  assert.equal(isConfidentOccasionPrediction({ label: "wedding", score: 0.8, margin: 0.069 }), false);
});

test("rejects unknown labels even when their score is high", () => {
  assert.equal(isConfidentOccasionPrediction({ label: "luxury", score: 0.99, margin: 0.5 }), false);
});

test("rejects empty and malformed model outputs", () => {
  assert.throws(() => selectOccasionPrediction([]), /no predictions/i);
  assert.throws(() => selectOccasionPrediction(null), /no predictions/i);
  assert.throws(() => selectOccasionPrediction([{ label: null, score: "NaN" }]), /invalid predictions/i);
});

test("supports dress-specific prompt labels", () => {
  const result = selectOccasionPrediction([
    { label: "a dress intended for wedding wear, bridal wear or a wedding guest", score: 0.72 },
    { label: "a dress intended for festive celebrations or festival wear", score: 0.2 }
  ], "dress");
  assert.equal(result.label, "wedding");
});

test("selects a known dominant colour from image prompt predictions", () => {
  const result = selectColourPrediction([
    { label: "a product photo of a saree whose main visible fabric or material colour is red", score: 0.62 },
    { label: "a product photo of a saree whose main visible fabric or material colour is pink", score: 0.20 },
    { label: "a product photo of a saree whose main visible fabric or material colour is blue", score: 0.08 }
  ]);
  assert.deepEqual(result, {
    label: "Red", score: 0.62, margin: 0.42,
    rankings: [
      { label: "Red", score: 0.62, rank: 1 },
      { label: "Pink", score: 0.2, rank: 2 },
      { label: "Blue", score: 0.08, rank: 3 }
    ]
  });
  assert.equal(isConfidentColourPrediction(result), true);
});

test("rejects uncertain or unknown colour predictions", () => {
  assert.equal(isConfidentColourPrediction({ label: "Red", score: 0.19, margin: 0.2 }), false);
  assert.equal(isConfidentColourPrediction({ label: "Red", score: 0.8, margin: 0.299 }), false);
  assert.equal(isConfidentColourPrediction({ label: "Turquoise", score: 0.99, margin: 0.5 }), false);
});

test("low-confidence valid colour remains a valid deterministic selection, not a manual-review gate", () => {
  // Confidence informs diagnostics only; a valid top colour can still be auto-saved.
  assert.equal(isConfidentColourPrediction({ label: "Gold", score: 0.3783, margin: 0.27 }), false);
  assert.ok(__test.COLOURS.includes("Gold"));
});

test("rejects empty and malformed colour model outputs", () => {
  assert.throws(() => selectColourPrediction([]), /no colour predictions/i);
  assert.throws(() => selectColourPrediction([{ label: null, score: "NaN" }]), /invalid colour predictions/i);
});


test("blocks checkout submission when no cart products remain enabled", () => {
  const checkout = readFileSync(new URL("../checkout.js", import.meta.url), "utf8");
  assert.match(checkout, /function visibleCart\(\)\{return cart\.filter\(row=>\{const product=getProduct\(row\.id\);return !!product&&isCategoryEnabled\(product\.category\);\}\);\}/,
    "checkout must derive submitted rows from products in currently enabled categories");
  assert.match(checkout, /const orderCart=visibleCart\(\);\s*if\(!orderCart\.length\)\{showStatus\("Your cart has no currently available products\."\);return\}/,
    "checkout must stop before submission when every cart item is disabled");
  assert.match(checkout, /items:orderCart\.map\(row=>\(\{id:row\.id,quantity:row\.quantity\}\)\)/,
    "the worker payload must use only the validated visible cart, never the raw cart");
  assert.match(checkout, /window\.addEventListener\("ssv:settings-updated",event=>\{const next=event\.detail\?\.settings;[\s\S]*?categorySettings=\{\.\.\.next\};categorySettingsReady=true;[\s\S]*?renderCart\(\);\}\);/,
    "a category settings update must refresh checkout eligibility and the visible cart");
});


test("returns deterministic occasion rankings and only the tied top labels", () => {
  const result = selectOccasionPrediction([
    { label: prompts.festive, score: 0.31 },
    { label: prompts.wedding, score: 0.29 },
    { label: prompts.daily, score: 0.14 },
    { label: "unknown label", score: 0.12 }
  ]);
  assert.deepEqual(result.rankings.map(item => item.label), ["festive", "wedding", "daily wear"]);
  assert.deepEqual(result.rankings.map(item => item.rank), [1, 2, 3]);
  assert.deepEqual(result.labels, ["festive"]);
  assert.equal(result.label, "festive");
  assert.equal(isConfidentOccasionPrediction(result), false);
});

test("limits deterministic inference to three passes and uses stable approved vocabularies", () => {
  assert.equal(__test.MAX_PASSES, 3);
  assert.equal(__test.OCCASION_TIE_TOLERANCE, 0.0005);
  assert.deepEqual(__test.COLOURS, [...new Set(__test.COLOURS)]);
  assert.deepEqual(__test.LABELS.map(item => item.label), ["daily wear", "wedding", "festive", "party wear", "traditional"]);
});

test("auto-saves a single valid colour and has no manual colour-review workflow", () => {
  const scanner = readFileSync(new URL("../saree-occasion-ai.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(scanner, /rankings:/);
  assert.match(admin, /addColour=needsColour&&!!colourToSave&&SSV_FINDER_COLOURS\.has\(colourToSave\)/);
  assert.match(admin, /savedProduct\?\.color===colourToSave/);
  assert.doesNotMatch(admin, /colourReviewSuggestions/);
  assert.doesNotMatch(admin, /async function ssvSaveReviewedColour/);
  assert.doesNotMatch(admin, /SAVE REVIEWED COLOUR/);
  assert.doesNotMatch(admin, /__ssvColourReviewSelections/);
  assert.match(admin, /occasionLabels\.every/);
  assert.ok(admin.includes("max-height:calc(100dvh - env(safe-area-inset-top"));
});
