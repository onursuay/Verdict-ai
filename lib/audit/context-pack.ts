// Çoklu kaynak audit pipeline'ının asıl orkestrasyon noktası.
//
// Aşamalar:
//   1) Kullanıcı seçimi (AuditSourceSelection) okunur.
//   2) Audit modu çıkarılır (inferAuditMode).
//   3) Mod'a göre kritik kaynak haritası belirlenir (MODE_CRITICAL_SOURCES).
//   4) Seçilen kaynaklar paralel taranır (Promise.all).
//   5) Local diff için GitHub raporu beklenir (eğer her ikisi de seçildiyse).
//   6) Toplam karakter bütçesi uygulanır (öncelik: github > supabase > vercel > local > worker).
//   7) Confidence hesaplanır.
//   8) finalDecisionAllowed kararı verilir (kritik kaynak eksik → false).

import { AUDIT_LIMITS, approxTokens } from "./limits";
import {
  inferAuditMode,
  MODE_CRITICAL_SOURCES,
  type AuditConfidence,
  type AuditContextPack,
  type AuditMode,
  type AuditSourceKind,
  type AuditSourceReport,
  type AuditSourceSelection,
  type GithubSourceReport,
  type LocalSourceReport,
  type SupabaseSourceReport,
  type VercelSourceReport,
  type WorkerSourceReport,
} from "./types";
import { runGithubSource } from "./sources/github";
import { runSupabaseSource } from "./sources/supabase";
import { runVercelSource } from "./sources/vercel";
import { runLocalPathSource } from "./sources/local-path";
import { runWorkerSource } from "./sources/worker";

export interface BuildContextPackInput {
  // Mod tespiti
  requestType?: string;
  problem?: string;
  projectName?: string;
  modeOverride?: AuditMode;
  // Source toggles (her biri açıkça verilir; default false)
  selection: AuditSourceSelection;
  // Source-specific inputs
  github?: { repoUrl?: string };
  supabase?: { userKey: string; projectRef?: string; projectName?: string };
  vercel?: { accessToken?: string; projectUrl?: string; projectSlug?: string };
  local?: { path?: string };
  worker?: { vpsHost?: string };
}

export interface ContextPackResult {
  pack: AuditContextPack;
  // Promta eklenecek tek string blok (tüm kaynakların promptBlock'ları toplandı, bütçe uygulandı).
  promptBlock: string;
}

// Mod'a göre kritik dosya path desenleri (GitHub ranking dışında kaldıysa uyarı verilir).
function modeExpectedPatterns(mode: AuditMode): string[] {
  switch (mode) {
    case "risk":
      return [
        "src/lib/engines/risk-engine\\.ts$",
        "src/lib/engines/bot-orchestrator\\.ts$",
        "src/lib/engines/signal-engine\\.ts$",
        "src/lib/engines/signal-score-gate\\.ts$",
        "src/lib/engines/strategy-health\\.ts$",
        "src/lib/engines/paper-trading-engine\\.ts$",
        "src/app/api/risk-settings/.*route\\.ts$",
        "src/app/api/paper-trades/.*route\\.ts$",
        "src/app/api/scanner/.*route\\.ts$",
      ];
    case "auth":
      return [
        "middleware\\.ts$",
        "src/app/api/auth/.*route\\.ts$",
        "src/lib/supabase.*\\.ts$",
      ];
    case "worker":
      return ["worker/.*\\.ts$", "docker-compose.*\\.ya?ml$"];
    case "deployment":
      return ["next\\.config\\..*", "vercel\\.json$", "package\\.json$"];
    case "database":
      return ["supabase/migrations/.*\\.sql$", "supabase/schema\\.sql$"];
    default:
      return [];
  }
}

export async function buildContextPack(input: BuildContextPackInput): Promise<ContextPackResult> {
  const generatedAt = new Date().toISOString();
  const mode = input.modeOverride ?? inferAuditMode({
    requestType: input.requestType,
    problem: input.problem,
    projectName: input.projectName,
  });
  const criticalKinds = new Set<AuditSourceKind>(MODE_CRITICAL_SOURCES[mode]);

  const isCritical = (k: AuditSourceKind) => criticalKinds.has(k);

  // 1) GitHub'ı önce çalıştır — HEAD commit SHA Vercel runner'a, dosya ağacı Local diff'ine lazım.
  const github: GithubSourceReport = await runGithubSource({
    selected: input.selection.github,
    critical: isCritical("github"),
    githubRepoUrl: input.github?.repoUrl,
    problem: input.problem,
    requestType: input.requestType,
    projectName: input.projectName,
    mode,
    expectedCriticalPatterns: modeExpectedPatterns(mode),
  });

  // 2) Supabase, Vercel, Worker paralel. Vercel artık github HEAD SHA'sı ile beslenir.
  const [supabase, vercel, worker]: [SupabaseSourceReport, VercelSourceReport, WorkerSourceReport] = await Promise.all([
    runSupabaseSource({
      selected: input.selection.supabase,
      critical: isCritical("supabase"),
      userKey: input.supabase?.userKey ?? "",
      projectRef: input.supabase?.projectRef,
      projectName: input.supabase?.projectName,
    }),
    runVercelSource({
      selected: input.selection.vercel,
      critical: isCritical("vercel"),
      accessToken: input.vercel?.accessToken,
      projectSlug: input.vercel?.projectSlug,
      projectUrl: input.vercel?.projectUrl,
      githubLatestCommit: github.status === "completed" ? github.headCommit : undefined,
    }),
    runWorkerSource({
      selected: input.selection.worker,
      critical: isCritical("worker"),
      vpsHost: input.worker?.vpsHost,
    }),
  ]);

  // 3) Local'i en son: GitHub raporu lazım (diff için)
  const local: LocalSourceReport = await runLocalPathSource({
    selected: input.selection.local,
    critical: isCritical("local"),
    localPath: input.local?.path,
    githubReport: github.status === "completed" ? github : undefined,
  });

  const reports: AuditContextPack["reports"] = {};
  if (input.selection.github) reports.github = github;
  if (input.selection.supabase) reports.supabase = supabase;
  if (input.selection.vercel) reports.vercel = vercel;
  if (input.selection.local) reports.local = local;
  if (input.selection.worker) reports.worker = worker;

  // Karakter bütçesi: github > supabase > vercel > local > worker
  const ordered: AuditSourceReport[] = [
    reports.github, reports.supabase, reports.vercel, reports.local, reports.worker,
  ].filter((x): x is AuditSourceReport => !!x);

  const limit = AUDIT_LIMITS.contextPackChars;
  const promptParts: string[] = [];
  let totalChars = 0;
  const warnings: string[] = [];
  for (const r of ordered) {
    if (!r.promptBlock) continue;
    if (totalChars + r.promptBlock.length > limit) {
      warnings.push(`Context Pack ${limit} karakter sınırına ulaştı; "${r.kind}" kaynağı kısmen veya tamamen kesildi.`);
      const remaining = Math.max(0, limit - totalChars);
      if (remaining > 200) promptParts.push(r.promptBlock.slice(0, remaining) + "\n…[bağlam bütçesi kesildi]");
      break;
    }
    promptParts.push(r.promptBlock);
    totalChars += r.promptBlock.length;
  }
  const promptBlock = promptParts.join("");

  // Confidence hesabı
  const selectedSources = Object.values(input.selection).filter(Boolean).length;
  const completedSources = Object.values(reports).filter((r): r is AuditSourceReport => !!r && r.status === "completed").length;
  const failedSources = Object.values(reports).filter((r): r is AuditSourceReport => !!r && (r.status === "error" || r.status === "unauthorized" || r.status === "timeout")).length;
  const notSelectedSources = 5 - selectedSources;

  const failedCriticalKinds: AuditSourceKind[] = [];
  for (const k of criticalKinds) {
    if (!input.selection[k]) continue; // seçilmediyse hata sayılmaz
    const r = reports[k as keyof typeof reports];
    if (r && (r.status === "error" || r.status === "unauthorized" || r.status === "timeout")) {
      failedCriticalKinds.push(k);
    }
  }
  // Kullanıcı kritik kaynakları HİÇ seçmediyse: insufficient (final karar verilmemeli).
  const missingCriticalSelections: AuditSourceKind[] = [];
  for (const k of criticalKinds) {
    if (!input.selection[k]) missingCriticalSelections.push(k);
  }

  const confidenceReason: string[] = [];
  let confidence: AuditConfidence;
  let finalDecisionAllowed = true;
  const finalDecisionBlockers: string[] = [];

  if (selectedSources === 0) {
    confidence = "insufficient";
    confidenceReason.push("Hiçbir kaynak seçilmedi.");
    finalDecisionAllowed = false;
    finalDecisionBlockers.push("En az bir audit kaynağı seçilmelidir.");
  } else if (failedCriticalKinds.length > 0) {
    confidence = "low";
    confidenceReason.push(`Kritik seçili kaynak(lar) başarısız: ${failedCriticalKinds.join(", ")}`);
    finalDecisionAllowed = false;
    finalDecisionBlockers.push(`Kritik kaynak başarısız: ${failedCriticalKinds.join(", ")}. Final patch kararı verilemez.`);
  } else if (missingCriticalSelections.length > 0 && selectedSources < criticalKinds.size) {
    confidence = "medium";
    confidenceReason.push(`Mod "${mode}" için kritik ama seçilmemiş kaynaklar: ${missingCriticalSelections.join(", ")}`);
  } else if (failedSources > 0) {
    confidence = "medium";
    confidenceReason.push(`${failedSources} yardımcı kaynak başarısız.`);
  } else {
    confidence = "high";
    confidenceReason.push("Tüm seçilen kaynaklar başarıyla tarandı.");
  }

  // Excluded critical files (github)
  if (reports.github?.excludedCriticalFiles?.length) {
    confidenceReason.push(`GitHub: kritik dosya pattern'leri seçilmedi (${reports.github.excludedCriticalFiles.length} desen).`);
    if (confidence === "high") confidence = "medium";
  }

  const pack: AuditContextPack = {
    mode,
    selection: input.selection,
    reports,
    totals: {
      contextChars: totalChars,
      contextCharsLimit: limit,
      approxTokens: approxTokens(totalChars),
      selectedSources,
      completedSources,
      failedSources,
      notSelectedSources,
    },
    confidence,
    confidenceReason,
    finalDecisionAllowed,
    finalDecisionBlockers,
    warnings,
    generatedAt,
  };

  return { pack, promptBlock };
}

// Default selection helper'ı: ProjectContext'ten otomatik ON yap.
// "Bağlantısı olan kaynak default olarak seçili" — kullanıcı toggle ile kapatabilir.
export function defaultSelectionFromContext(args: {
  hasGithubRepo: boolean;
  hasSupabaseProject: boolean;
  hasVercelToken: boolean;
  hasLocalPath: boolean;
  hasVpsHost: boolean;
}): AuditSourceSelection {
  return {
    github: args.hasGithubRepo,
    supabase: args.hasSupabaseProject,
    vercel: args.hasVercelToken,
    local: args.hasLocalPath,
    worker: args.hasVpsHost,
  };
}
