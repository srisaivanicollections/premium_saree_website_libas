import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const liveSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const legacySource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function liveDefaultCategory(settings) {
  const start = liveSource.indexOf("function ssvDefaultStorefrontCategory(");
  const end = liveSource.indexOf("\\nfunction renderTabs()", start);
  assert.ok(start >= 0 && end > start, "live storefront default-category helper must exist");
  const helper = liveSource.slice(start, end);
  const isEnabled = name => {
    const normalized = String(name || "").trim().toLowerCase();
    const key = ({ sarees: "categorySareesEnabled", dresses: "categoryDressesEnabled", jewellery: "categoryJewelryEnabled", jewelry: "categoryJewelryEnabled" })[normalized];
    if (!key) return false;
    const value = settings[key];
    return !(value === false || value === "false" || value === 0 || value === "0");
  };
  return new Function("isCategoryEnabled", helper + "\\nreturn ssvDefaultStorefrontCategory([]);")(isEnabled);
}

test("initial category is the first enabled category, even when it has no products", () => {
  assert.equal(liveDefaultCategory({ categorySareesEnabled: false }), "Dresses");
  assert.equal(liveDefaultCategory({ categorySareesEnabled: false, categoryDressesEnabled: false }), "Jewellery");
  assert.equal(liveDefaultCategory({ categorySareesEnabled: false, categoryDressesEnabled: false, categoryJewelryEnabled: false }), "Sarees");
  assert.match(liveSource, /function ssvDefaultStorefrontCategory\\(items=products\\)\\{const enabled=\\["Sarees","Dresses","Jewellery"\\]\\.filter\\(isCategoryEnabled\\);return enabled\\[0\\]\\|\\|"Sarees";\\}/);
});

test("disabled categories are omitted and an enabled empty category remains selectable", () => {
  assert.match(liveSource, /function renderTabs\\(\\)\\{const enabled=\\["Sarees","Dresses","Jewellery"\\]\\.filter\\(isCategoryEnabled\\);if\\(categorySettingsReady&&category!=="__browse_all__"&&!enabled\\.includes\\(category\\)\\)category=ssvDefaultStorefrontCategory\\(products\\);/);
  assert.match(liveSource, /\\$\\("#tabs"\\)\\.innerHTML=enabled\\.map\\(c=>/);
  assert.doesNotMatch(liveSource, /!products\\.some\\(p=>normalizeCategoryName\\(p\\?\\.category\\)/, "renderTabs must not fall back because a category has zero products");
  assert.match(liveSource, /if\\(!list\\.length\\)\\{[\\s\\S]*?No styles found/, "an empty selected category must render the empty state");
  assert.match(liveSource, /categoryWasManuallySelected=true/, "manual category selection must be tracked");
});

test("settings refresh preserves a manual selection unless that category is disabled", () => {
  assert.match(liveSource, /if\\(!categoryWasManuallySelected&&category!=="__browse_all__"&&!isCategoryEnabled\\(category\\)\\)category=ssvDefaultStorefrontCategory\\(products\\)/);
  assert.match(liveSource, /category=normalizeCategoryName\\(selected\\);categoryWasManuallySelected=true/);
  assert.match(liveSource, /showAllProducts\\(\\)\\{category="__browse_all__"/);
  assert.doesNotMatch(liveSource, /data-tab="All"|data-tab="Best Seller"/);
  assert.doesNotMatch(legacySource, /\\["All","Sarees","Dresses","Jewellery","Best Seller"\\]/);
});
