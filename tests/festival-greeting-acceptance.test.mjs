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
  assert.match(controller, /hasOwnProperty\.call\(defaults,s\.festivalGreetingFestival\)/, "Only an explicitly selected supported festival may display");
  assert.doesNotMatch(controller, /getMonth\(\).*festival|new Date\(\).*festival/i, "Festival must not be inferred from the calendar");
});

test("blank title and message use the selected festival defaults", () => {
  assert.match(controller, /festivalGreetingTitle:cleanText\(s\.festivalGreetingTitle,100\)\|\|\(fallback\?fallback\[0\]:""\)/);
  assert.match(controller, /festivalGreetingMessage:cleanText\(s\.festivalGreetingMessage,300\)\|\|\(fallback\?fallback\[1\]:""\)/);
  assert.match(controller, /function hydrateAdminDefaults\(\)/);
  assert.match(controller, /if\(title&&!title\.value\.trim\(\)\)title\.value=fallback\[0\]/);
  assert.match(controller, /if\(message&&!message\.value\.trim\(\)\)message\.value=fallback\[1\]/);
});

test("date validation rejects impossible dates and honors inclusive boundaries", () => {
  const fnSource = controller.match(/function isValidDate\(value\)\{[\s\S]*?\}/)?.[0];
  assert.ok(fnSource, "Date validation function must exist");
  const isValidDate = new Function("value", fnSource.replace(/^function isValidDate\(value\)\{/, "").replace(/\}$/, ""));
  assert.equal(isValidDate("2026-10-20"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.match(controller, /if\(start&&today<start\)return false/);
  assert.match(controller, /if\(end&&today>end\)return false/);
  assert.match(controller, /if\(start&&end&&start>end\)return false/);
});

test("dismissal, keyboard focus, and scroll lock are implemented", () => {
  assert.match(html, /aria-modal="true"/);
  assert.match(controller, /if\(e\.key==="Escape"\)/);
  assert.match(controller, /if\(e\.shiftKey&&document\.activeElement===first\)/);
  assert.match(controller, /function closePopup\(\)/);
  assert.match(controller, /document\.body\.style\.overflow=previousOverflow/);
  assert.match(controller, /lastFocus\.focus\(\{preventScroll:true\}\)/);
  assert.match(controller, /backdrop\.addEventListener\("click",e=>\{if\(e\.target===backdrop\)closePopup\(\)\}\)/);
});

test("popup stays off by default and layout supports small viewports", () => {
  assert.match(html, /toggle\('Enable festival greeting','festivalGreetingEnabled',false\)/);
  assert.match(controller, /if\(!s\|\|s\.festivalGreetingEnabled!==true\)return false/);
  assert.match(html, /width:min\(520px,100%\)/);
  assert.match(html, /max-height:calc\(100dvh - 32px\)/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /min-height|width:44px;height:44px/);
});
