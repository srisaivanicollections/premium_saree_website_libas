import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const liveSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
  const helper = new Function("products", "settings", source.slice(start, end) + "\nreturn ssvDefaultStorefrontCategory(products);");
  assert.equal(helper([{category:"Dresses"},{category:"Sarees"}], {}), "Sarees");
  assert.equal(helper([{category:"Dresses"}], {}), "Dresses");
  assert.equal(helper([{category:"Accessories"}], {}), "Accessories");
  assert.equal(helper([], {}), "Sarees");
});


test("live GitHub Pages storefront selects the first populated enabled category after settings load", () => {
  assert.match(liveSource, /function ssvDefaultStorefrontCategory\(items=products\)/);
  assert.match(liveSource, /if\(category==="__browse_all__"\|\|!isCategoryEnabled\(category\)\)category=ssvDefaultStorefrontCategory\(products\)/);
  assert.match(liveSource, /category=ssvDefaultStorefrontCategory\(products\);window\.dispatchEvent\(new CustomEvent\("ssv:settings-updated"/, "Active inline storefront must select the default category before first render, not rely only on app.js");
  assert.match(liveSource, /if\(categorySettingsReady&&category!=="__browse_all__"&&\(!enabled\.includes\(category\)\|\|!products\.some/);
  assert.match(liveSource, /if\(clear\)clear\.onclick=\(\)=>\{category=ssvDefaultStorefrontCategory\(products\)/);
  assert.match(liveSource, /if\(catalogReset\)catalogReset\.onclick=\(\)=>\{\s*category=ssvDefaultStorefrontCategory\(products\);/, "Reset must restore the first populated enabled category");
  assert.match(liveSource, /showAllProducts\(\)\{category="__browse_all__"/);
  assert.doesNotMatch(liveSource, /data-tab="All"|data-tab="Best Seller"/, "Removed category tabs must not be rendered");
  assert.doesNotMatch(source, /\["All","Sarees","Dresses","Jewellery","Best Seller"\]/, "Legacy app.js category tabs must stay removed");
});
