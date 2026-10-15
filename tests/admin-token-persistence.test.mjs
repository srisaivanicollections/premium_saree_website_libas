import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const getterStart = html.indexOf("function getSavedGithubToken(){");
const getterEnd = html.indexOf("\n/* Keep the token accessor available", getterStart);
assert.ok(getterStart >= 0 && getterEnd > getterStart, "token accessor must be present");
const getterSource = html.slice(getterStart, getterEnd);

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
    values
  };
}

function runGetter(localSeed = {}, sessionSeed = {}) {
  const localStorage = storage(localSeed);
  const sessionStorage = storage(sessionSeed);
  const window = {};
  const getSavedGithubToken = new Function(
    "GITHUB_TOKEN_KEY", "ADMIN_TOKEN_KEY", "LEGACY_TOKEN_KEY",
    "localStorage", "sessionStorage", "window",
    getterSource + "\nreturn getSavedGithubToken;"
  )("ssv_github_token_v1", "gh_admin_token_libas", "github_token",
    localStorage, sessionStorage, window);
  return { token: getSavedGithubToken(), localStorage, sessionStorage, window };
}

function functionSource(name, nextName) {
  const start = html.indexOf(name);
  const end = html.indexOf(nextName, start);
  assert.ok(start >= 0 && end > start, `expected function range: ${name}`);
  return html.slice(start, end);
}

test("canonical saved token is reused when its prefix is not recognized by this client", () => {
  const result = runGetter({ ssv_github_token_v1: "future_github_token_format" });
  assert.equal(result.token, "future_github_token_format");
});

test("empty or missing canonical token is treated as missing", () => {
  assert.equal(runGetter({ ssv_github_token_v1: "   " }).token, "");
  assert.equal(runGetter().token, "");
});

test("legacy localStorage token is recovered and migrated to the canonical key", () => {
  const legacy = "ghp_" + "testToken012345678901234567890123456789";
  const result = runGetter({ github_token: legacy });
  assert.equal(result.token, legacy);
  assert.equal(result.localStorage.getItem("ssv_github_token_v1"), legacy);
});

test("sessionStorage token is recovered and migrated for persistence", () => {
  const legacy = "github_pat_" + "testToken012345678901234567890123456789";
  const result = runGetter({}, { gh_admin_token_libas: legacy });
  assert.equal(result.token, legacy);
  assert.equal(result.localStorage.getItem("ssv_github_token_v1"), legacy);
});

test("unrelated application storage values are not treated as tokens", () => {
  const result = runGetter({ theme: "dark", cart: '{"token":"not-a-github-token"}' });
  assert.equal(result.token, "");
});

test("OTP is verified before the saved token is read", () => {
  const verify = functionSource("async function verifyAdminOtp()", "\nfunction logoutAdmin()");
  const otpIndex = verify.indexOf('await callOtpWorker("verify",email,otp)');
  const tokenIndex = verify.indexOf("const token=getSavedGithubToken()");
  assert.ok(otpIndex >= 0, "OTP verification call must exist");
  assert.ok(tokenIndex > otpIndex, "token must not be used before OTP verification");
});

test("401 and 403 catalogue failures reopen token setup without opening Admin Studio", () => {
  const verify = functionSource("async function verifyAdminOtp()", "\nfunction logoutAdmin()");
  assert.match(verify, /catalogError\?\.status===401\|\|\(catalogError\?\.status===403&&!catalogError\?\.rateLimited\)/);
  assert.match(verify, /else if\(catalogError\?\.rateLimited\)/);
  assert.match(verify, /Your saved token has not been changed/);
  assert.match(verify, /showGithubStorageSetup\(\)/);
  assert.match(verify, /return false;/);
  assert.ok(verify.indexOf("showGithubStorageSetup()") < verify.indexOf("adminSessionActive=true"));
});

test("replacement token is checked against products and settings before success", () => {
  const connect = functionSource("async function connectGithubStorage()", "\nfunction resetOtpScreen()");
  assert.match(connect, /await githubReadJson\("data\/products\.json"\)/);
  assert.match(connect, /await githubReadJsonFresh\("data\/settings\.json"\)/);
  assert.match(connect, /hideGithubStorageSetup\(\)/);
  assert.ok(connect.indexOf('await githubReadJson("data/products.json")') < connect.indexOf("hideGithubStorageSetup()"));
});

test("failed replacement restores the previous canonical token", () => {
  const connect = functionSource("async function connectGithubStorage()", "\nfunction resetOtpScreen()");
  assert.match(connect, /const previousLocal=localStorage\.getItem\(GITHUB_TOKEN_KEY\)\|\|""/);
  assert.match(connect, /if\(previousLocal\)localStorage\.setItem\(GITHUB_TOKEN_KEY,previousLocal\)/);
  assert.match(connect, /else localStorage\.removeItem\(GITHUB_TOKEN_KEY\)/);
});

test("logout ends the session without deleting the saved token", () => {
  const logout = functionSource("function logoutAdmin()", "\nif(!window.__LIBAS_ADMIN_OTP_BOUND)");
  assert.match(logout, /adminSessionActive=false/);
  assert.match(logout, /otpAdminSession=false/);
  assert.doesNotMatch(logout, /localStorage\.removeItem|sessionStorage\.removeItem|localStorage\.clear|sessionStorage\.clear/);
});


test("GitHub 403 rate-limit responses are distinguished from invalid credentials", () => {
  assert.match(html, /error\.rateLimited=r\.status===403&&\(/);
  assert.match(html, /x-ratelimit-remaining/);
  assert.match(html, /retry-after/);
  assert.match(html, /error\.rateLimitReset=r\.headers\.get\("x-ratelimit-reset"\)/);
});
