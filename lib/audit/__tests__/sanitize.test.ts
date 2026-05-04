import { test } from "node:test";
import { strict as assert } from "node:assert";
import { sanitizeString, sanitizeObject, maskPrivateIps, maskEmail } from "../sanitize";

test("sanitize: GitHub PAT redacted", () => {
  const out = sanitizeString("token=ghp_1234567890abcdefABCDEFGHIJKLMNOPQRSTuv next");
  assert.match(out, /\[REDACTED:github-pat\]/);
  assert.doesNotMatch(out, /ghp_1234567890/);
});

test("sanitize: OpenAI sk- key redacted", () => {
  const out = sanitizeString("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH");
  assert.match(out, /\[REDACTED:openai-key\]/);
});

test("sanitize: JWT redacted", () => {
  const jwt = "eyJabcdefghij.eyJpYXQiOjE2MTIzNDU2Nzg5.signaturepart9876543210";
  const out = sanitizeString(`Authorization: Bearer ${jwt}`);
  assert.match(out, /\[REDACTED:bearer\]|\[REDACTED:jwt\]/);
  assert.doesNotMatch(out, /eyJpYXQiOjE2MTIzNDU2Nzg5/);
});

test("sanitize: contextual token-like only when keyword present", () => {
  const safe = sanitizeString("commitsha 1234567890abcdef1234567890abcdef");
  // No "token/secret/password" keyword; should NOT be masked
  assert.match(safe, /1234567890abcdef1234567890abcdef/);
  const unsafe = sanitizeString("api_key=1234567890abcdef1234567890abcdef");
  assert.match(unsafe, /\[REDACTED:token-like\]/);
});

test("sanitizeObject: redacts known secret keys by name", () => {
  const obj = { foo: "ok", access_token: "deadbeef", nested: { service_role_key: "abc" } };
  const out = sanitizeObject(obj) as typeof obj;
  assert.equal(out.foo, "ok");
  assert.equal(out.access_token, "[REDACTED:value-by-key]");
  assert.equal(out.nested.service_role_key, "[REDACTED:value-by-key]");
});

test("maskPrivateIps", () => {
  assert.equal(maskPrivateIps("host 10.0.5.7 down"), "host 10.0.x.x down");
  assert.equal(maskPrivateIps("public 8.8.8.8 ok"), "public 8.8.8.8 ok");
});

test("maskEmail", () => {
  assert.equal(maskEmail("contact me at onursuay@hotmail.com please"), "contact me at on***@hotmail.com please");
});
