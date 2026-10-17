import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const mobileFix = html.slice(html.lastIndexOf('<style id="ssv-admin-mobile-product-list-regression-20261017">'));

test("Admin product rows remain full-width flex rows", () => {
  assert.match(mobileFix, /#admin #studioBody \.admin-item\{[\s\S]*?display:flex !important;[\s\S]*?width:100% !important;[\s\S]*?min-width:0 !important;/);
  assert.match(mobileFix, /#admin #studioBody \.admin-product-main\{[\s\S]*?flex:1 1 (?:auto|0%) !important;[\s\S]*?min-width:0 !important;/);
  assert.match(mobileFix, /#admin #studioBody \.admin-item > \.danger\{[\s\S]*?flex:0 0 auto !important;/);
});

test("Admin product text can wrap without forcing narrow columns", () => {
  assert.match(mobileFix, /#admin #studioBody \.admin-product-copy strong\{[\s\S]*?white-space:normal !important;[\s\S]*?overflow-wrap:anywhere !important;/);
  assert.match(mobileFix, /#admin #studioBody \.admin-product-copy small\{[\s\S]*?white-space:normal !important;/);
  assert.match(mobileFix, /#admin #studioBody \.admin-product-copy \.admin-product-meta\{[\s\S]*?white-space:normal !important;[\s\S]*?overflow-wrap:anywhere !important;/);
});

test("occasion badges wrap as intact pills at mobile widths", () => {
  assert.match(mobileFix, /#admin #studioBody \.admin-occasion-badges,[\s\S]*?flex-wrap:wrap !important;/);
  assert.match(mobileFix, /#admin #studioBody \.admin-occasion-badge,[\s\S]*?white-space:nowrap !important;[\s\S]*?word-break:normal !important;/);
  assert.match(mobileFix, /@media\(max-width:600px\)\{[\s\S]*?#admin #studioBody \.admin-product-thumb\{[\s\S]*?height:56px !important;/);
});

test("product list keeps Edit actions and preserves selected occasions on save", () => {
  assert.match(app, /class="admin-item"/);
  assert.match(app, /class="danger edit"/);
  assert.match(app, /occasions:\[\.\.\.document\.querySelectorAll\('input\[name="fOccasion"\]:checked'\)\]/);
});
