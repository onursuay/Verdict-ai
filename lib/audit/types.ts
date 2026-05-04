// Çoklu kaynak audit pipeline'ının tipleri.
// 5 kaynak: github | supabase | vercel | local | worker.
// Her kaynağın bağımsız bir AuditSourceReport'u olur.
// Pipeline çıktısı: AuditContextPack.

export type AuditSourceKind =
  | "github"
  | "supabase"
  | "vercel"
  | "local"
  | "worker";

export type AuditSourceStatus =
  // Kullanıcı toggle'ı kapalı bıraktı → audit'e dahil edilmedi.
  | "not_selected"
  // Kullanıcı seçti ama henüz tarama başlamadı.
  | "pending"
  // Tarama akıyor (live UI).
  | "scanning"
  // Tarama başarılı tamamlandı.
  | "completed"
  // Tarama denendi ama hata aldı (config / yetki / network).
  | "error"
  // Yetki yok (token eksik, scope yetersiz, OAuth bağlı değil).
  | "unauthorized"
  // Zaman aşımı.
  | "timeout"
  // Sistem bu kaynak için hiç yapılandırılmamış (ör. local path env yok).
  | "not_configured";

export type AuditConfidence = "high" | "medium" | "low" | "insufficient";

export interface AuditSourceSelection {
  github: boolean;
  supabase: boolean;
  vercel: boolean;
  local: boolean;
  worker: boolean;
}

export interface AuditSourceReportBase {
  kind: AuditSourceKind;
  selected: boolean;
  status: AuditSourceStatus;
  // İnsan-okuyabilir kısa özet (UI'da chip altı satırı için).
  summary: string;
  // Audit raporunda gösterilecek ek detay satırları (sanitize edilmiş).
  detail: string[];
  warnings: string[];
  errorMessage?: string;
  // Bu kaynak audit güveninde kritik mi? (mod'a göre değişir)
  critical: boolean;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  // Prompt'a eklenecek metin bloğu (sanitize edilmiş).
  promptBlock?: string;
  // Karakter cinsinden promptBlock uzunluğu (raporlama için).
  promptBlockChars?: number;
}

export interface GithubSourceReport extends AuditSourceReportBase {
  kind: "github";
  owner?: string;
  repo?: string;
  branch?: string;
  // Branch HEAD commit SHA. Vercel production commit ile karşılaştırma için
  // VercelSourceReport.productionCommitMatchesGithub'da kullanılır.
  headCommit?: string;
  treeEntryCount?: number;
  treeTruncated?: boolean;
  rankedFileCount?: number;
  readFileCount?: number;
  fullContextFileCount?: number;
  summarizedFileCount?: number;
  excludedCriticalFiles?: string[];
  selectedFiles?: Array<{
    path: string;
    size: number;
    language: string;
    reason: string;
    truncated: boolean;
    chars: number;
  }>;
}

export interface SupabaseSourceReport extends AuditSourceReportBase {
  kind: "supabase";
  projectRef?: string;
  projectName?: string;
  tableCount?: number;
  policyCount?: number;
  rlsEnabledTables?: number;
  rlsDisabledTables?: number;
  functionCount?: number;
  storageBucketCount?: number;
  tables?: Array<{ schema: string; name: string; rlsEnabled: boolean; columns: number }>;
  policies?: Array<{ schema: string; table: string; name: string; command: string; permissive: boolean }>;
  functions?: Array<{ schema: string; name: string; returnType: string }>;
  storageBuckets?: Array<{ id: string; name: string; public: boolean }>;
}

export interface VercelSourceReport extends AuditSourceReportBase {
  kind: "vercel";
  projectId?: string;
  projectName?: string;
  productionDomain?: string;
  latestDeployment?: {
    id: string;
    state: string;
    target?: string;
    branch?: string;
    commit?: string;
    commitMessage?: string;
    createdAt: string;
    readyAt?: string;
  };
  buildSucceeded?: boolean;
  envKeys?: Array<{ key: string; targets: string[]; type: string }>;
  envKeyCount?: number;
  productionCommitMatchesGithub?: boolean | null;
}

export interface LocalSourceReport extends AuditSourceReportBase {
  kind: "local";
  rootPath?: string;
  resolvedPath?: string;
  fileCount?: number;
  totalBytes?: number;
  excludedDirs?: string[];
  diffWithGithub?: {
    onlyInLocal: string[];
    onlyInGithub: string[];
    contentDiffers: string[];
  };
  selectedFiles?: Array<{ relativePath: string; size: number; chars: number }>;
}

export interface WorkerSourceReport extends AuditSourceReportBase {
  kind: "worker";
  endpoint?: string;
  workerId?: string;
  runningMode?: string;
  lastHeartbeatAt?: string;
  ageMs?: number;
  online?: boolean;
  lastError?: string;
  meta?: Record<string, unknown>;
}

export type AuditSourceReport =
  | GithubSourceReport
  | SupabaseSourceReport
  | VercelSourceReport
  | LocalSourceReport
  | WorkerSourceReport;

export type AuditMode =
  | "risk"
  | "auth"
  | "worker"
  | "api"
  | "ui"
  | "database"
  | "deployment"
  | "architecture"
  | "general";

export interface AuditContextPack {
  mode: AuditMode;
  selection: AuditSourceSelection;
  reports: {
    github?: GithubSourceReport;
    supabase?: SupabaseSourceReport;
    vercel?: VercelSourceReport;
    local?: LocalSourceReport;
    worker?: WorkerSourceReport;
  };
  totals: {
    contextChars: number;
    contextCharsLimit: number;
    approxTokens: number;
    selectedSources: number;
    completedSources: number;
    failedSources: number;
    notSelectedSources: number;
  };
  confidence: AuditConfidence;
  confidenceReason: string[];
  finalDecisionAllowed: boolean;
  finalDecisionBlockers: string[];
  warnings: string[];
  generatedAt: string;
}

// Mod-spesifik kritiklik haritası: hangi kaynaklar bu mod için kritik?
export const MODE_CRITICAL_SOURCES: Record<AuditMode, AuditSourceKind[]> = {
  risk: ["github", "supabase"],
  auth: ["github", "supabase", "vercel"],
  worker: ["github", "worker"],
  api: ["github"],
  ui: ["github"],
  database: ["supabase"],
  deployment: ["github", "vercel"],
  architecture: ["github"],
  general: ["github"],
};

// Talep tipinden audit moduna otomatik eşleme.
// Sıra: en spesifik altyapı terimleri önce; "api" gibi geniş terimler en sona.
export function inferAuditMode(args: { requestType?: string; problem?: string; projectName?: string }): AuditMode {
  const text = `${args.requestType ?? ""} ${args.problem ?? ""} ${args.projectName ?? ""}`.toLowerCase();
  if (/\brisk\b|paper.?trad|signal[- ]?engine|orchestrator|signal[- ]?score|live[-_ ]?safety|paper[- ]?trades|risk[- ]?settings/.test(text)) return "risk";
  if (/\bauth\b|login|register|callback|middleware|session|jwt|rls/.test(text)) return "auth";
  if (/\bworker\b|heartbeat\b|\bvps\b|runtime|cron|background[- ]?job/.test(text)) return "worker";
  if (/\bdeploy|vercel|build[- ]?error|production[- ]?env|env(ironment)?[- ]?(eksik|missing|var(?!iable)|degisken)/.test(text)) return "deployment";
  if (/\bdatabase\b|schema|migration|\bsql\b|policy\b|supabase\b/.test(text)) return "database";
  if (/\bui\b|ux|component|design|frontend|tailwind/.test(text)) return "ui";
  if (/\bapi\b|endpoint|\broute\b|webhook/.test(text)) return "api";
  if (/\bmimari\b|architecture|\bsistem\b/.test(text)) return "architecture";
  return "general";
}
