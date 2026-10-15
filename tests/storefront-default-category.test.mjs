import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("storefront opens the first populated visible category instead of All", () => {
  assert.match(source, /category="Sarees"/);
  assert.match(source, /category=ssvDefaultStorefrontCategory\(products\)/);
  assert.match(source, /function ssvDefaultStorefrontCategory\(items=products\)/);
  assert.match(source, /\["Sarees","Dresses","Jewellery"\]/);
  assert.match(source, /clear\.onclick=\(\)=>\{category=ssvDefaultStorefrontCategory\(products\)/);
});

test("default category falls back through the visible category order and then the first populated category", () => {
  const start = source.indexOf("function ssvDefaultStorefrontCategory(");
  const end = source.indexOf("\nfunction renderTabs()", start);
  assert.ok(start >= 0 && end > start);
  const helper = new Function("products", source.slice(start, end) + "\nreturn ssvDefaultStorefrontCategory(products);");
  assert.equal(helper([{category:"Dresses"},{category:"Sarees"}]), "Sarees");
  assert.equal(helper([{category:"Dresses"}]), "Dresses");
  assert.equal(helper([{category:"Accessories"}]), "Accessories");
  assert.equal(helper([]), "Sarees");
});
