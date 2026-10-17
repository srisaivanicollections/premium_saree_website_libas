import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const mobileFix = html.slice(html.lastIndexOf('<style id="ssv-admin-mobile-product-list-regression-20261017">'));

test("Admin product list has one vertical scroll column and stable flex rows", () => {
  assert.ok(mobileFix.includes("#admin #adminProductsScroll.admin-products-scroll{"));
  assert.ok(mobileFix.includes("display:flex!important;flex-direction:column!important;"));
  assert.ok(mobileFix.includes("overflow-x:hidden!important;overflow-y:auto!important;"));
  assert.ok(mobileFix.includes("max-height:none!important;overflow:visible!important;"));
  assert.ok(mobileFix.includes("@media(max-width:600px){\n  #admin #adminProductsScroll.admin-products-scroll{gap:8px!important;padding:4px 2px 12px!important;max-height:62vh!important;overflow-x:hidden!important;overflow-y:auto!important;}"));
  assert.ok(mobileFix.includes("display:flex!important;flex-flow:row nowrap!important;"));
  assert.ok(mobileFix.includes("width:100%!important;min-width:0!important;max-width:100%!important;"));
});

test("thumbnail and Edit button keep intrinsic widths while product copy receives remaining space", () => {
  assert.ok(mobileFix.includes("flex:1 1 0%!important;flex-direction:row!important;align-items:center!important;gap:9px!important;"));
  assert.ok(mobileFix.includes("flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;"));
  assert.ok(mobileFix.includes("display:flex!important;flex:1 1 0%!important;flex-direction:column!important;"));
  assert.ok(mobileFix.includes("display:inline-flex!important;flex:0 0 auto!important;align-self:center!important;"));
});

test("product title and metadata can wrap inside the flexible copy column", () => {
  assert.ok(mobileFix.includes("white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;"));
  assert.ok(mobileFix.includes("text-overflow:clip!important;overflow-wrap:anywhere!important;word-break:normal!important;"));
  assert.ok(mobileFix.includes("width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;"));
});

test("occasion and status badges wrap rather than forcing the product row wider", () => {
  assert.ok(mobileFix.includes("flex-direction:row!important;flex-wrap:wrap!important;"));
  assert.ok(mobileFix.includes("max-width:100%!important;white-space:normal!important;"));
  assert.ok(mobileFix.includes("flex-wrap:wrap!important;align-items:center!important;gap:5px!important;"));
  assert.ok(mobileFix.includes("@media(max-width:600px)"));
  assert.ok(mobileFix.includes("@media(max-width:360px)"));
});

test("Admin product renderer emits one status container, not nested duplicate wrappers", () => {
  assert.equal((html.match(/<div class="admin-product-status">/g) || []).length, 1);
  assert.equal(html.includes('<div class="admin-product-status"><div class="admin-product-status">'), false);
  assert.ok(html.includes('class="admin-status is-available"'));
});

test("product list keeps Edit actions and preserves selected occasions on save", () => {
  assert.match(app, /class="admin-item"/);
  assert.match(app, /class="danger edit"/);
  assert.match(app, /occasions:\[\.\.\.document\.querySelectorAll\('input\[name="fOccasion"\]:checked'\)\]/);
});
