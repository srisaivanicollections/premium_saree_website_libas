import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("Admin product rows remain full-width flex rows", () => {
  assert.match(css, /#admin #studioBody \.admin-item\{[\s\S]*?display:flex !important;[\s\S]*?width:100% !important;[\s\S]*?min-width:0 !important;/);
  assert.match(css, /#admin #studioBody \.admin-product-main\{[\s\S]*?flex:1 1 auto !important;[\s\S]*?min-width:0 !important;/);
  assert.match(css, /#admin #studioBody \.admin-item > \.danger\{[\s\S]*?flex:0 0 auto !important;/);
});

test("Admin product text can wrap without forcing narrow columns", () => {
  assert.match(css, /#admin #studioBody \.admin-product-copy strong\{[\s\S]*?white-space:normal !important;[\s\S]*?overflow-wrap:anywhere !important;/);
  assert.match(css, /#admin #studioBody \.admin-product-copy small\{[\s\S]*?white-space:normal !important;/);
});

test("occasion badges wrap as intact pills at mobile widths", () => {
  assert.match(css, /#admin #studioBody \.admin-occasion-badges,[\s\S]*?flex-wrap:wrap !important;/);
  assert.match(css, /#admin #studioBody \.admin-occasion-badge,[\s\S]*?white-space:nowrap !important;[\s\S]*?word-break:normal !important;/);
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*?#admin #studioBody \.admin-product-thumb\{[\s\S]*?height:56px !important;/);
});

test("product list keeps Edit actions and preserves selected occasions on save", () => {
  assert.match(app, /class="admin-item"/);
  assert.match(app, /class="danger edit"/);
  assert.match(app, /occasions:\[\.\.\.document\.querySelectorAll\('input\[name="fOccasion"\]:checked'\)\]/);
});
