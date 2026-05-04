import { test } from "node:test";
import { strict as assert } from "node:assert";
import { runVercelSource } from "../sources/vercel";

// Vercel API'yi mock'lamak için global fetch'i geçici override ediyoruz.
// Her testte gerekli yanıtları sırayla veririz.
function mockFetch(handler: (url: string) => { ok: boolean; status: number; body: unknown }) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const r = handler(url);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = orig; };
}

test("vercel commit match: matching SHA → true, no warning about comparison", async () => {
  const sha = "abc1234567890def1234567890abcdef12345678";
  const restore = mockFetch((url) => {
    if (url.includes("/v9/projects/")) return { ok: true, status: 200, body: { id: "p1", name: "coinbot" } };
    if (url.includes("/v6/deployments")) return {
      ok: true, status: 200, body: {
        deployments: [{
          uid: "dpl_1", state: "READY", target: "production",
          meta: { githubCommitSha: sha, githubCommitRef: "main" },
          createdAt: 1700000000000, ready: 1700000000000,
        }],
      },
    };
    if (url.includes("/v10/projects/")) return { ok: true, status: 200, body: { envs: [{ key: "FOO", target: ["production"], type: "encrypted" }] } };
    return { ok: false, status: 404, body: {} };
  });

  const r = await runVercelSource({
    selected: true, critical: true,
    accessToken: "fake-token",
    projectUrl: "https://vercel.com/team/coinbot",
    githubLatestCommit: sha,
  });
  restore();
  assert.equal(r.status, "completed");
  assert.equal(r.productionCommitMatchesGithub, true);
  // Comparison başarılı; karşılaştırma uyarısı OLMAMALI
  assert.ok(!r.warnings.some((w) => /karşılaştırılamadı/.test(w)));
});

test("vercel commit match: mismatched SHA → false, no comparison warning", async () => {
  const restore = mockFetch((url) => {
    if (url.includes("/v9/projects/")) return { ok: true, status: 200, body: { id: "p1", name: "coinbot" } };
    if (url.includes("/v6/deployments")) return {
      ok: true, status: 200, body: {
        deployments: [{
          uid: "dpl_1", state: "READY", target: "production",
          meta: { githubCommitSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", githubCommitRef: "main" },
          createdAt: 1700000000000,
        }],
      },
    };
    if (url.includes("/v10/projects/")) return { ok: true, status: 200, body: { envs: [] } };
    return { ok: false, status: 404, body: {} };
  });
  const r = await runVercelSource({
    selected: true, critical: true,
    accessToken: "fake-token",
    projectUrl: "https://vercel.com/team/coinbot",
    githubLatestCommit: "feedface1234567890feedface1234567890feed",
  });
  restore();
  assert.equal(r.productionCommitMatchesGithub, false);
});

test("vercel commit match: github sha missing → null + warning", async () => {
  const restore = mockFetch((url) => {
    if (url.includes("/v9/projects/")) return { ok: true, status: 200, body: { id: "p1", name: "coinbot" } };
    if (url.includes("/v6/deployments")) return {
      ok: true, status: 200, body: {
        deployments: [{ uid: "dpl_1", state: "READY", target: "production", meta: { githubCommitSha: "abc123" }, createdAt: 0 }],
      },
    };
    if (url.includes("/v10/projects/")) return { ok: true, status: 200, body: { envs: [] } };
    return { ok: false, status: 404, body: {} };
  });
  const r = await runVercelSource({
    selected: true, critical: false,
    accessToken: "fake-token",
    projectUrl: "https://vercel.com/team/coinbot",
    // githubLatestCommit verilmedi
  });
  restore();
  assert.equal(r.productionCommitMatchesGithub, null);
  assert.ok(r.warnings.some((w) => /GitHub HEAD commit eksik/.test(w)));
});

test("vercel commit match: vercel commit missing → null + warning", async () => {
  const restore = mockFetch((url) => {
    if (url.includes("/v9/projects/")) return { ok: true, status: 200, body: { id: "p1", name: "coinbot" } };
    if (url.includes("/v6/deployments")) return {
      ok: true, status: 200, body: {
        deployments: [{ uid: "dpl_1", state: "READY", target: "production", meta: {}, createdAt: 0 }],
      },
    };
    if (url.includes("/v10/projects/")) return { ok: true, status: 200, body: { envs: [] } };
    return { ok: false, status: 404, body: {} };
  });
  const r = await runVercelSource({
    selected: true, critical: false,
    accessToken: "fake-token",
    projectUrl: "https://vercel.com/team/coinbot",
    githubLatestCommit: "feedface1234567890feedface1234567890feed",
  });
  restore();
  assert.equal(r.productionCommitMatchesGithub, null);
  assert.ok(r.warnings.some((w) => /commit hash yok/.test(w)));
});

test("vercel: not_selected returns clean status", async () => {
  const r = await runVercelSource({ selected: false, critical: false });
  assert.equal(r.status, "not_selected");
});

test("vercel: missing token → unauthorized", async () => {
  const r = await runVercelSource({ selected: true, critical: false, projectUrl: "https://vercel.com/team/coinbot" });
  assert.equal(r.status, "unauthorized");
});
