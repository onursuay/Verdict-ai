// Vercel deployment & env-presence okuyucu.
//
// Token kaynağı: NextRequest cookie `vercel_access_token` (route'tan inject edilir).
// Promta giren bilgiler:
//   - Project id/name, production domain
//   - Son deployment: state, target, branch, commit hash, message, createdAt
//   - Env var ANAHTAR İSİMLERİ (target, type) — DEĞERLER asla okunmaz/promta yazılmaz
//
// Eksik/expired token, scope yetersizliği, network hatası graceful raporlanır.

import { sanitizeString, sanitizeObject } from "../sanitize";
import { AUDIT_LIMITS } from "../limits";
import type { VercelSourceReport } from "../types";

const VERCEL_API = "https://api.vercel.com";

export interface RunVercelSourceArgs {
  selected: boolean;
  critical: boolean;
  accessToken?: string;
  // Form'dan gelen Vercel project URL'sinden çıkarılan slug, ör. "onur-suay/coinbot".
  projectSlug?: string;
  projectUrl?: string;
  // GitHub'dan gelen son commit (varsa). prod commit ile karşılaştırma için.
  githubLatestCommit?: string;
}

interface VercelDeployment {
  uid: string;
  url?: string;
  state?: string;
  target?: string | null;
  meta?: { githubCommitSha?: string; githubCommitMessage?: string; githubCommitRef?: string };
  createdAt?: number;
  ready?: number;
  source?: string;
}
interface VercelProject {
  id: string;
  name: string;
  alias?: Array<{ domain?: string; target?: string }>;
  targets?: { production?: { alias?: string[] } };
}
interface VercelEnvItem { key: string; type?: string; target?: string[]; }

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function authedJson<T>(token: string, path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; reason: string }> {
  try {
    const res = await fetchWithTimeout(`${VERCEL_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    }, AUDIT_LIMITS.vercelFetchTimeoutMs);
    if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, reason: e instanceof Error ? e.message : "network" };
  }
}

function deriveProjectIdFromUrl(url?: string, slug?: string): string | undefined {
  // vercel.com/<team>/<project> → "<project>" (Vercel API project lookup adıyla yapılabilir)
  const candidate = slug?.split("/")?.pop()?.trim();
  if (candidate) return candidate;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1] : undefined;
  } catch { return undefined; }
}

export async function runVercelSource(args: RunVercelSourceArgs): Promise<VercelSourceReport> {
  const startedAt = new Date().toISOString();
  const base = {
    kind: "vercel" as const,
    selected: args.selected,
    critical: args.critical,
    detail: [] as string[],
    warnings: [] as string[],
    startedAt,
  };

  if (!args.selected) {
    return { ...base, status: "not_selected", summary: "Vercel kaynağı kullanıcı tarafından seçilmedi." };
  }
  if (!args.accessToken) {
    return {
      ...base,
      status: "unauthorized",
      summary: "Vercel OAuth bağlantısı yok.",
      errorMessage: "vercel_access_token cookie'si eksik veya süresi dolmuş.",
      finishedAt: new Date().toISOString(),
    };
  }
  const projectId = deriveProjectIdFromUrl(args.projectUrl, args.projectSlug);
  if (!projectId) {
    return {
      ...base,
      status: "error",
      summary: "Vercel proje bilgisi (slug/URL) eksik.",
      errorMessage: "projectSlug veya projectUrl sağlanmadı; deployment okunamaz.",
      finishedAt: new Date().toISOString(),
    };
  }

  const t0 = Date.now();
  const projRes = await authedJson<VercelProject>(args.accessToken, `/v9/projects/${encodeURIComponent(projectId)}`);
  const deplRes = await authedJson<{ deployments: VercelDeployment[] }>(args.accessToken, `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=10&state=READY,ERROR,CANCELED,BUILDING`);
  const envRes = await authedJson<{ envs: VercelEnvItem[] }>(args.accessToken, `/v10/projects/${encodeURIComponent(projectId)}/env`);
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;

  const failures: string[] = [];
  if (!projRes.ok) failures.push(`project(${projRes.reason})`);
  if (!deplRes.ok) failures.push(`deployments(${deplRes.reason})`);
  if (!envRes.ok) failures.push(`env(${envRes.reason})`);

  if (!projRes.ok && !deplRes.ok && !envRes.ok) {
    const auth = [projRes, deplRes, envRes].some((r) => !r.ok && (r.status === 401 || r.status === 403));
    return {
      ...base,
      status: auth ? "unauthorized" : "error",
      summary: auth ? "Vercel erişim yetkisi yetersiz." : "Vercel API erişilemedi.",
      errorMessage: failures.join(", "),
      finishedAt,
      durationMs,
    };
  }
  const warnings: string[] = [];
  if (failures.length) warnings.push(`Bazı Vercel uçları okunamadı: ${failures.join(", ")}`);

  const project = projRes.ok ? projRes.data : undefined;
  const deployments = deplRes.ok ? deplRes.data.deployments : [];
  const envs = envRes.ok ? envRes.data.envs : [];

  // Production domain: targets.production.alias[0] veya alias listesinden production.
  const productionDomain = project?.targets?.production?.alias?.[0]
    || project?.alias?.find((a) => a.target === "production")?.domain
    || undefined;

  const productionDeployment = deployments.find((d) => d.target === "production")
    || deployments[0];

  let buildSucceeded: boolean | undefined;
  if (productionDeployment?.state) {
    const s = productionDeployment.state.toUpperCase();
    if (s === "READY") buildSucceeded = true;
    else if (s === "ERROR" || s === "CANCELED") buildSucceeded = false;
    else buildSucceeded = undefined; // BUILDING/QUEUED
  }

  const latestDeployment = productionDeployment ? {
    id: productionDeployment.uid,
    state: productionDeployment.state ?? "unknown",
    target: productionDeployment.target ?? undefined,
    branch: productionDeployment.meta?.githubCommitRef,
    commit: productionDeployment.meta?.githubCommitSha,
    commitMessage: productionDeployment.meta?.githubCommitMessage,
    createdAt: productionDeployment.createdAt ? new Date(productionDeployment.createdAt).toISOString() : "",
    readyAt: productionDeployment.ready ? new Date(productionDeployment.ready).toISOString() : undefined,
  } : undefined;

  const envKeys = envs.map((e) => ({ key: e.key, targets: e.target ?? [], type: e.type ?? "" }));

  // Production deploy commit ile GitHub HEAD commit karşılaştırması.
  // - İki taraf da bilgi sağladıysa boolean
  // - Bilgi eksikse null + warning'e neden ekle
  let productionCommitMatchesGithub: boolean | null = null;
  if (args.githubLatestCommit && latestDeployment?.commit) {
    const a = args.githubLatestCommit.toLowerCase();
    const b = latestDeployment.commit.toLowerCase();
    productionCommitMatchesGithub = a === b || a.startsWith(b) || b.startsWith(a);
  } else if (!args.githubLatestCommit && latestDeployment?.commit) {
    warnings.push("GitHub HEAD commit eksik (GitHub kaynağı seçilmedi veya repo URL'si yok); production-vs-main eşleşmesi karşılaştırılamadı.");
  } else if (args.githubLatestCommit && !latestDeployment?.commit) {
    warnings.push("Vercel son deploy meta'sında commit hash yok; production-vs-main eşleşmesi karşılaştırılamadı.");
  } else {
    warnings.push("GitHub HEAD ve Vercel deploy commit'inin ikisi de mevcut değil; karşılaştırma yapılamadı.");
  }

  const promptBlock = sanitizeString(buildVercelPromptBlock({
    projectName: project?.name,
    projectId: project?.id,
    productionDomain,
    latestDeployment,
    buildSucceeded,
    envKeys,
    productionCommitMatchesGithub,
    githubLatestCommit: args.githubLatestCommit,
  }));

  return {
    ...base,
    status: "completed",
    summary: `Vercel: ${project?.name ?? projectId} • prod=${latestDeployment?.state ?? "?"} • env=${envKeys.length}`,
    detail: [
      `Proje: ${project?.name ?? projectId} (id=${project?.id ?? "?"})`,
      productionDomain ? `Production domain: ${productionDomain}` : "Production domain: (bulunamadı)",
      latestDeployment ? `Son deploy: ${latestDeployment.state} • commit=${latestDeployment.commit?.slice(0, 7) ?? "?"} • branch=${latestDeployment.branch ?? "?"}` : "Son deploy: (yok)",
      `Env key sayısı: ${envKeys.length} (değerler okunmadı)`,
      productionCommitMatchesGithub === true ? "GitHub main ile production commit uyumlu" :
        productionCommitMatchesGithub === false ? "GitHub main ile production commit FARKLI" : "GitHub-Vercel commit uyumu kontrol edilmedi",
    ],
    warnings,
    finishedAt,
    durationMs,
    projectId: project?.id,
    projectName: project?.name,
    productionDomain,
    latestDeployment,
    buildSucceeded,
    envKeys: sanitizeObject(envKeys),
    envKeyCount: envKeys.length,
    productionCommitMatchesGithub,
    promptBlock,
    promptBlockChars: promptBlock.length,
  };
}

function buildVercelPromptBlock(args: {
  projectName?: string;
  projectId?: string;
  productionDomain?: string;
  latestDeployment?: VercelSourceReport["latestDeployment"];
  buildSucceeded?: boolean;
  envKeys: Array<{ key: string; targets: string[]; type: string }>;
  productionCommitMatchesGithub: boolean | null;
  githubLatestCommit?: string;
}): string {
  const lines: string[] = [];
  lines.push("\n\nVERCEL BAĞLAMI:");
  lines.push(`- Proje: ${args.projectName ?? "?"} (id=${args.projectId ?? "?"})`);
  if (args.productionDomain) lines.push(`- Production domain: ${args.productionDomain}`);
  if (args.latestDeployment) {
    lines.push(`- Son production deploy: state=${args.latestDeployment.state}, target=${args.latestDeployment.target ?? "?"}, branch=${args.latestDeployment.branch ?? "?"}, commit=${args.latestDeployment.commit ?? "?"}`);
    if (args.latestDeployment.commitMessage) lines.push(`  commitMessage: ${args.latestDeployment.commitMessage}`);
    if (args.latestDeployment.createdAt) lines.push(`  createdAt: ${args.latestDeployment.createdAt}`);
  }
  if (typeof args.buildSucceeded === "boolean") lines.push(`- Build durumu: ${args.buildSucceeded ? "BAŞARILI" : "BAŞARISIZ"}`);
  if (args.productionCommitMatchesGithub === true) {
    lines.push(`- GitHub main commit ile prod deploy uyumlu (${args.githubLatestCommit?.slice(0, 7) ?? ""}).`);
  } else if (args.productionCommitMatchesGithub === false) {
    lines.push(`- UYARI: GitHub main commit (${args.githubLatestCommit?.slice(0, 7)}) ile prod deploy commit (${args.latestDeployment?.commit?.slice(0, 7)}) farklı. Production eski commit'te kalmış olabilir.`);
  }
  if (args.envKeys.length) {
    const grouped = args.envKeys.map((e) => `${e.key}[${e.targets.join("|") || "?"}]`);
    lines.push(`- Env key isimleri (değerler okunmadı): ${grouped.join(", ")}`);
  }
  lines.push("ÖNEMLİ: Vercel env değerleri prompta YAZILMADI. Yalnızca anahtar isimleri ve hedef ortamlar gösterildi. Eğer kodun beklediği bir env adı yoksa bu eksiklik olarak rapor edilmelidir.");
  return lines.join("\n");
}
