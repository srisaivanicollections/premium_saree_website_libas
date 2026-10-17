import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const mobileFix = html.slice(html.lastIndexOf('<style id="ssv-admin-mobile-product-list-regression-20261017">'));

test("Admin product list is a single column and product rows use stable flex sizing", () => {
  assert.match(mobileFix, /#admin #adminProductsScroll\\.admin-products-scroll\\{[\\s\\S]*?display:flex!important;flex-direction:column!important;[\\s\\S]*?overflow-x:hidden!important;overflow-y:auto!important;/);
  assert.match(mobileFix, /#admin #adminProductsScroll\\.admin-products-scroll > \\.admin-item\\{[\\s\\S]*?display:flex!important;flex-flow:row nowrap!important;[\\s\\S]*?width:100%!important;min-width:0!important;max-width:100%!important/);
  assert.match(mobileFix, /\\.admin-product-main\\{[\\s\\S]*?flex:1 1 0%!important;[\\s\\S]*?width:0!important;min-width:0!important/);
});

test("Admin product row keeps thumbnail, copy, and Edit action in separate stable columns", () => {
  assert.match(mobileFix, /\.admin-product-main\{[\s\S]*?grid-template-columns:44px minmax\(0,1fr\)!important/);
  assert.match(mobileFix, /\.admin-product-thumb\{[\s\S]*?width:44px!important;min-width:44px!important;max-width:44px!important/);
  assert.match(mobileFix, /\.admin-product-copy\{[\s\S]*?min-width:0!important;max-width:100%!important/);
  assert.match(mobileFix, /\.danger\.edit\{[\s\S]*?grid-column:2!important;grid-row:1!important/);
});

test("Admin product text and metadata wrap within the product copy column", () => {
  assert.match(mobileFix, /\.admin-product-copy > strong\{[\s\S]*?white-space:normal!important;[\s\S]*?overflow-wrap:anywhere!important/);
  assert.match(mobileFix, /\.admin-product-meta\{[\s\S]*?white-space:normal!important;[\s\S]*?overflow-wrap:anywhere!important/);
});

test("occasion badges wrap as intact pills at mobile widths", () => {
  assert.match(mobileFix, /\.admin-occasion-badges\{[\s\S]*?flex-wrap:wrap!important/);
  assert.match(mobileFix, /\.admin-occasion-badge\{[\s\S]*?white-space:normal!important;overflow-wrap:anywhere!important/);
  assert.match(mobileFix, /@media\(max-width:600px\)\{[\s\S]*?\.admin-product-thumb\{[\s\S]*?height:54px!important/);
  assert.match(mobileFix, /@media\(max-width:360px\)\{[\s\S]*?\.admin-product-thumb\{[\s\S]*?height:49px!important/);
});

test("product list keeps Edit actions and preserves selected occasions on save", () => {
  assert.match(app, /class="admin-item"/);
  assert.match(app, /class="danger edit"/);
  assert.match(app, /occasions:\[\.\.\.document\.querySelectorAll\('input\[name="fOccasion"\]:checked'\)\]/);
});


test("Admin product copy is flexible and duplicate status wrappers are absent", () => {
  assert.match(mobileFix, /\\.admin-product-copy\\{[\\s\\S]*?flex:1 1 0%!important;[\\s\\S]*?width:0!important;min-width:0!important/);
  assert.match(mobileFix, /\\.admin-product-copy > strong\\{[\\s\\S]*?white-space:normal!important;[\\s\\S]*?overflow-wrap:anywhere!important/);
  assert.doesNotMatch(html, /<div class="admin-product-status"><div class="admin-product-status">/);
  assert.match(html, /<div class="admin-product-status">[\\s\\S]*?admin-status is-available/);
});

test("Admin product row regression rules cover narrow mobile viewports", () => {
  assert.match(mobileFix, /@media\\(max-width:600px\\)/);
  assert.match(mobileFix, /@media\\(max-width:360px\\)/);
  assert.match(mobileFix, /\\.admin-occasion-badges\\{[\\s\\S]*?flex-wrap:wrap!important/);
});
