import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildContextPack, defaultSelectionFromContext } from "../context-pack";
import { inferAuditMode } from "../types";

test("inferAuditMode: risk", () => {
  const m = inferAuditMode({ requestType: "Hata", problem: "risk-engine ve paper-trading-engine arasında signal-score-gate çalışmıyor" });
  assert.equal(m, "risk");
});

test("inferAuditMode: auth", () => {
  const m = inferAuditMode({ requestType: "Güvenlik", problem: "login middleware production'da bozuk; jwt callback failing" });
  assert.equal(m, "auth");
});

test("inferAuditMode: deployment", () => {
  const m = inferAuditMode({ requestType: "API Entegrasyonu", problem: "vercel deploy build error production env eksik" });
  assert.equal(m, "deployment");
});

test("defaultSelectionFromContext: ON for connected sources", () => {
  const sel = defaultSelectionFromContext({
    hasGithubRepo: true,
    hasSupabaseProject: false,
    hasVercelToken: true,
    hasLocalPath: false,
    hasVpsHost: false,
  });
  assert.deepEqual(sel, { github: true, supabase: false, vercel: true, local: false, worker: false });
});

test("buildContextPack: not_selected sources never block decision", async () => {
  // Hiç kaynak seçili değil → confidence insufficient + finalDecisionAllowed false
  const { pack } = await buildContextPack({
    requestType: "Hata", problem: "x",
    selection: { github: false, supabase: false, vercel: false, local: false, worker: false },
  });
  assert.equal(pack.totals.selectedSources, 0);
  assert.equal(pack.confidence, "insufficient");
  assert.equal(pack.finalDecisionAllowed, false);
  // Tüm raporlar reports objesinden çıkmalı (toggle kapalı = report yok)
  assert.equal(Object.keys(pack.reports).length, 0);
});

test("buildContextPack: only github selected, no repo url → error", async () => {
  const { pack } = await buildContextPack({
    requestType: "Hata", problem: "x",
    selection: { github: true, supabase: false, vercel: false, local: false, worker: false },
    github: { repoUrl: undefined },
  });
  assert.equal(pack.reports.github?.status, "error");
  assert.equal(pack.totals.failedSources, 1);
  // GitHub kritik (general mode için) → final decision allowed false
  assert.equal(pack.finalDecisionAllowed, false);
});

test("buildContextPack: github not selected → not flagged as error", async () => {
  const { pack } = await buildContextPack({
    requestType: "UI/UX Kararı", problem: "frontend renk değişikliği",
    selection: { github: false, supabase: false, vercel: false, local: true, worker: false },
    local: { path: undefined },
  });
  // GitHub seçilmediğine göre, github raporu yok
  assert.equal(pack.reports.github, undefined);
  // Local path verilmedi → error olur ama UI mode için kritik değil
  assert.equal(pack.reports.local?.status, "error");
});
