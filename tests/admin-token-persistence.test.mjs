import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("function getSavedGithubToken(){");
const end = html.indexOf("\n/* Keep the token accessor available", start);
assert.ok(start >= 0 && end > start, "token accessor must be present");
const getterSource = html.slice(start, end);

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

test("canonical saved token is reused even if its prefix is not recognized by an older build", () => {
  const result = runGetter({ ssv_github_token_v1: "future_github_token_format" });
  assert.equal(result.token, "future_github_token_format");
});

test("legacy token is recovered and migrated to the canonical localStorage key", () => {
  const legacy = "ghp_" + "testToken012345678901234567890123456789";
  const result = runGetter({ github_token: legacy });
  assert.equal(result.token, legacy);
  assert.equal(result.localStorage.getItem("ssv_github_token_v1"), legacy);
});

test("sessionStorage token remains recoverable and is migrated for persistence", () => {
  const legacy = "github_pat_" + "testToken012345678901234567890123456789";
  const result = runGetter({}, { gh_admin_token_libas: legacy });
  assert.equal(result.token, legacy);
  assert.equal(result.localStorage.getItem("ssv_github_token_v1"), legacy);
});

test("missing token remains missing and OTP verification is still required", () => {
  assert.equal(runGetter().token, "");
  const verifyStart = html.indexOf("async function verifyAdminOtp()");
  const verifyEnd = html.indexOf("\nfunction logoutAdmin()", verifyStart);
  const verify = html.slice(verifyStart, verifyEnd);
  assert.ok(verify.indexOf('await callOtpWorker("verify",email,otp)') >= 0);
  assert.ok(verify.indexOf('await callOtpWorker("verify",email,otp)') < verify.indexOf("const token=getSavedGithubToken()"));
});

test("logout ends the session without deleting the saved token", () => {
  const logoutStart = html.indexOf("function logoutAdmin()");
  const logoutEnd = html.indexOf("\nif(!window.__LIBAS_ADMIN_OTP_BOUND)", logoutStart);
  const logout = html.slice(logoutStart, logoutEnd);
  assert.match(logout, /adminSessionActive=false/);
  assert.match(logout, /otpAdminSession=false/);
  assert.doesNotMatch(logout, /localStorage\.removeItem|sessionStorage\.removeItem|localStorage\.clear|sessionStorage\.clear/);
});
