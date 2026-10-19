import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const controller = html.match(/<script id="ssv-festival-greeting-text-only-controller">([\s\S]*?)<\/script>/)?.[1];
assert.ok(controller, "Festival greeting controller must exist");

test("all supported festival IDs have defaults and selection is explicit", () => {
  const defaultsBlock = controller.match(/const defaults=\{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(defaultsBlock, "Greeting defaults map must exist");
  const ids = [...defaultsBlock.matchAll(/^\s*([a-z0-9_]+):\[/gm)].map(m => m[1]);
  assert.equal(ids.length, 13, "All 13 supported festival groups must have defaults");
  for (const id of ids) assert.match(html, new RegExp('option value="' + id + '"'), "Admin dropdown missing " + id);
  assert.match(controller, /hasOwnProperty\.call\(defaults,s\.festivalGreetingFestival\)/);
  assert.doesNotMatch(controller, /getMonth\(\).*festival|new Date\(\).*festival/i);
});

test("blank title and message use selected festival defaults", () => {
  assert.match(controller, /festivalGreetingTitle:cleanText\(s\.festivalGreetingTitle,100\)\|\|\(fallback\?fallback\[0\]:""\)/);
  assert.match(controller, /festivalGreetingMessage:cleanText\(s\.festivalGreetingMessage,300\)\|\|\(fallback\?fallback\[1\]:""\)/);
  assert.match(controller, /function hydrateAdminDefaults\(\)/);
  assert.match(controller, /title\.value=fallback\[0\]/);
  assert.match(controller, /message\.value=fallback\[1\]/);
});

test("date validation rejects impossible dates and date boundaries are inclusive", () => {
  const line = controller.split("\n").find(line => line.includes("function isValidDate(value)"));
  assert.ok(line, "Date validation function must exist on one line");
  const source = line.trim().replace(/^function isValidDate\(value\)\{/, "").replace(/\}$/, "");
  const isValidDate = new Function("value", source);
  assert.equal(isValidDate("2026-10-20"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.match(controller, /if\(start&&today<start\)return false/);
  assert.match(controller, /if\(end&&today>end\)return false/);
  assert.match(controller, /start&&end&&start>end\)return false/);
});

test("dismissal, keyboard focus, and scroll lock are implemented", () => {
  assert.match(html, /aria-modal="true"/);
  assert.match(controller, /e\.key==="Escape"/);
  assert.match(controller, /e\.shiftKey&&document\.activeElement===first/);
  assert.match(controller, /function closePopup\(\)/);
  assert.match(controller, /document\.body\.style\.overflow=previousOverflow/);
  assert.match(controller, /lastFocus\.focus\(\{preventScroll:true\}\)/);
  assert.match(controller, /backdrop\.addEventListener\("click",e=>\{if\(e\.target===backdrop\)closePopup\(\);\}\)/);
});

test("popup is disabled by default and has small-viewport layout safeguards", () => {
  assert.match(html, /toggle\('Enable festival greeting','festivalGreetingEnabled',false\)/);
  assert.match(controller, /if\(!s\|\|s\.festivalGreetingEnabled!==true\)return false/);
  assert.match(html, /width:min\(520px,100%\)/);
  assert.match(html, /max-height:calc\(100dvh - 32px\)/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /width:44px;height:44px/);
});
