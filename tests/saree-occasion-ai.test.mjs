import test from "node:test";
import assert from "node:assert/strict";
import { selectOccasionPrediction, isConfidentOccasionPrediction, selectColourPrediction, isConfidentColourPrediction } from "../saree-occasion-ai.js";

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
  assert.deepEqual(result, { label: "Red", score: 0.62, margin: 0.42 });
  assert.equal(isConfidentColourPrediction(result), true);
});

test("rejects uncertain or unknown colour predictions", () => {
  assert.equal(isConfidentColourPrediction({ label: "Red", score: 0.19, margin: 0.2 }), false);
  assert.equal(isConfidentColourPrediction({ label: "Red", score: 0.8, margin: 0.299 }), false);
  assert.equal(isConfidentColourPrediction({ label: "Turquoise", score: 0.99, margin: 0.5 }), false);
});

test("keeps a known risky printed-dress prediction for manual review", () => {
  // The Blue frock was previously predicted as Gold at score 0.3783 / margin 0.27.
  assert.equal(isConfidentColourPrediction({ label: "Gold", score: 0.3783, margin: 0.27 }), false);
});

test("rejects empty and malformed colour model outputs", () => {
  assert.throws(() => selectColourPrediction([]), /no colour predictions/i);
  assert.throws(() => selectColourPrediction([{ label: null, score: "NaN" }]), /invalid colour predictions/i);
});
