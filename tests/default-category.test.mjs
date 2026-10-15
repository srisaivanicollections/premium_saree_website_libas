import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function getFirstDisplayCategory(){");
const end = source.indexOf("\n", start);
assert.ok(start >= 0 && end > start, "default category helper must exist");
const helper = source.slice(start, end);
const getDefault = (products, settings = {}) => new Function("products", "settings", helper + "\nreturn getFirstDisplayCategory();")(products, settings);

test("storefront defaults to the first available displayed category, not All", () => {
  const products = [{category:"Sarees"}, {category:"Dresses"}];
  assert.equal(getDefault(products, {}), "Sarees");
});

test("missing first category falls forward to the next available enabled category", () => {
  assert.equal(getDefault([{category:"Dresses"}], {}), "Dresses");
});

test("disabled Jewellery is never selected as the default category", () => {
  assert.equal(getDefault([{category:"Jewellery"}, {category:"Dresses"}], {categoryJewelryEnabled:false}), "Dresses");
});

test("All remains an explicit user-selectable tab and initial category is chosen after settings load", () => {
  assert.match(source, /\["All","Sarees","Dresses","Jewellery","Best Seller"\]/);
  assert.match(source, /if\(!categoryInitialized\)\{category=getFirstDisplayCategory\(\);categoryInitialized=true;\}/);
  assert.match(source, /clear\.onclick=\(\)=>\{category=getFirstDisplayCategory\(\)/);
});
