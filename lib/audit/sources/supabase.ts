// Supabase metadata kaynak okuyucu.
//
// Management API üzerinden bağlı projeden okuduğumuz şeyler:
//   - Proje meta (ref, name, region, status)
//   - Database tabloları + RLS durumu (information_schema + pg_class via pg-meta)
//   - RLS policy'leri (pg_policies)
//   - PostgreSQL fonksiyonları (pg_proc → public schema)
//   - Storage bucket'ları (Storage Admin API)
//
// Service role / anon key gibi gizli değerler PROMPTA AKMAZ:
//   • Sadece teknik metadata (tablo adı, kolon adı, policy adı, function adı, bucket adı, public flag)
//   • Anahtar/secret okumaya çalışılmaz; varsa tüm çıktı sanitizeObject ile maskelenir
//   • SAMPLE row almıyoruz; hassas veri korunur

import { sanitizeObject, sanitizeString } from "../sanitize";
import { AUDIT_LIMITS } from "../limits";
import { getActiveSupabaseConnection } from "../../supabase-management/connection-store";
import type { SupabaseSourceReport } from "../types";

const MANAGEMENT_API = "https://api.supabase.com";

export interface RunSupabaseSourceArgs {
  selected: boolean;
  critical: boolean;
  userKey: string;
  projectRef?: string;
  projectName?: string;
}

interface PgTable { schema: string; name: string; rls_enabled?: boolean; columns?: Array<{ name: string }> }
interface PgPolicy { schema: string; table: string; name: string; command?: string; action?: string; permissive?: boolean }
interface PgFunction { schema: string; name: string; return_type?: string }
interface StorageBucket { id: string; name: string; public?: boolean }

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
    const res = await fetchWithTimeout(`${MANAGEMENT_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    }, AUDIT_LIMITS.supabaseFetchTimeoutMs);
    if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, reason: e instanceof Error ? e.message : "network" };
  }
}

export async function runSupabaseSource(args: RunSupabaseSourceArgs): Promise<SupabaseSourceReport> {
  const startedAt = new Date().toISOString();
  const base = {
    kind: "supabase" as const,
    selected: args.selected,
    critical: args.critical,
    detail: [] as string[],
    warnings: [] as string[],
    startedAt,
  };

  if (!args.selected) {
    return { ...base, status: "not_selected", summary: "Supabase kaynağı kullanıcı tarafından seçilmedi." };
  }
  if (!args.projectRef?.trim()) {
    return {
      ...base,
      status: "error",
      summary: "Supabase seçildi ancak proje ref'i bağlanmadı.",
      errorMessage: "Supabase project ref eksik.",
      finishedAt: new Date().toISOString(),
    };
  }
  const conn = await getActiveSupabaseConnection(args.userKey);
  if (!conn) {
    return {
      ...base,
      status: "unauthorized",
      summary: "Supabase OAuth bağlantısı bulunamadı.",
      errorMessage: "Aktif Supabase OAuth bağlantısı yok; lütfen yeniden bağlanın.",
      finishedAt: new Date().toISOString(),
      projectRef: args.projectRef,
    };
  }

  const t0 = Date.now();
  const ref = encodeURIComponent(args.projectRef);
  const warnings: string[] = [];

  // Tables (pg-meta)
  const tablesRes = await authedJson<PgTable[]>(conn.accessToken, `/v1/projects/${ref}/database/tables?included_schemas=public,auth,storage`);
  // Policies
  const policiesRes = await authedJson<PgPolicy[]>(conn.accessToken, `/v1/projects/${ref}/database/policies?included_schemas=public,auth,storage`);
  // Functions
  const functionsRes = await authedJson<PgFunction[]>(conn.accessToken, `/v1/projects/${ref}/database/functions?included_schemas=public`);
  // Storage buckets
  const bucketsRes = await authedJson<StorageBucket[]>(conn.accessToken, `/v1/projects/${ref}/storage/buckets`);

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;

  // Hata toplama: hepsi başarısızsa unauthorized/error dön; bazıları varsa partial completed.
  const failures: string[] = [];
  if (!tablesRes.ok) failures.push(`tables(${tablesRes.reason})`);
  if (!policiesRes.ok) failures.push(`policies(${policiesRes.reason})`);
  if (!functionsRes.ok) failures.push(`functions(${functionsRes.reason})`);
  if (!bucketsRes.ok) failures.push(`storage(${bucketsRes.reason})`);

  const allFailed = !tablesRes.ok && !policiesRes.ok && !functionsRes.ok && !bucketsRes.ok;
  if (allFailed) {
    const auth = [tablesRes, policiesRes, functionsRes, bucketsRes].some((r) => !r.ok && (r.status === 401 || r.status === 403));
    return {
      ...base,
      status: auth ? "unauthorized" : "error",
      summary: auth ? "Supabase erişim izni yetersiz." : "Supabase metadata okunamadı.",
      errorMessage: failures.join(", "),
      finishedAt,
      durationMs,
      projectRef: args.projectRef,
      projectName: args.projectName,
    };
  }
  if (failures.length) warnings.push(`Bazı Supabase metadata uçları okunamadı: ${failures.join(", ")}`);

  const tablesRaw = tablesRes.ok ? tablesRes.data.slice(0, AUDIT_LIMITS.supabaseMaxTables) : [];
  const policiesRaw = policiesRes.ok ? policiesRes.data.slice(0, AUDIT_LIMITS.supabaseMaxPolicies) : [];
  const functionsRaw = functionsRes.ok ? functionsRes.data : [];
  const bucketsRaw = bucketsRes.ok ? bucketsRes.data : [];

  const tables = tablesRaw.map((t) => ({
    schema: t.schema,
    name: t.name,
    rlsEnabled: !!t.rls_enabled,
    columns: t.columns?.length ?? 0,
  }));
  const policies = policiesRaw.map((p) => ({
    schema: p.schema,
    table: p.table,
    name: p.name,
    command: (p.command || p.action || "ALL").toUpperCase(),
    permissive: p.permissive !== false,
  }));
  const functions = functionsRaw.map((f) => ({ schema: f.schema, name: f.name, returnType: f.return_type ?? "" }));
  const buckets = bucketsRaw.map((b) => ({ id: b.id, name: b.name, public: !!b.public }));

  const rlsEnabled = tables.filter((t) => t.rlsEnabled).length;
  const rlsDisabled = tables.length - rlsEnabled;

  const sanitizedTables = sanitizeObject(tables);
  const sanitizedPolicies = sanitizeObject(policies);
  const sanitizedFunctions = sanitizeObject(functions);
  const sanitizedBuckets = sanitizeObject(buckets);

  const promptBlock = sanitizeString(buildSupabasePromptBlock({
    projectRef: args.projectRef,
    projectName: args.projectName,
    tableCount: tables.length,
    policyCount: policies.length,
    rlsEnabled,
    rlsDisabled,
    functionCount: functions.length,
    bucketCount: buckets.length,
    publicBuckets: buckets.filter((b) => b.public).map((b) => b.name),
    rlsDisabledTables: tables.filter((t) => !t.rlsEnabled).map((t) => `${t.schema}.${t.name}`),
    sampleTables: tables.slice(0, 30).map((t) => `${t.schema}.${t.name}${t.rlsEnabled ? "" : " [RLS_OFF]"}`),
    samplePolicies: policies.slice(0, 30).map((p) => `${p.schema}.${p.table}: ${p.name} (${p.command})`),
    sampleFunctions: functions.slice(0, 30).map((f) => `${f.schema}.${f.name}() → ${f.returnType}`),
  }));

  return {
    ...base,
    status: "completed",
    summary: `Supabase: ${tables.length} tablo, ${policies.length} policy, ${functions.length} fn, ${buckets.length} bucket`,
    detail: [
      `Proje ref: ${args.projectRef}`,
      ...(args.projectName ? [`Ad: ${args.projectName}`] : []),
      `Tablolar: ${tables.length} (RLS açık: ${rlsEnabled}, kapalı: ${rlsDisabled})`,
      `Policy: ${policies.length}`,
      `Function: ${functions.length}`,
      `Storage bucket: ${buckets.length}`,
    ],
    warnings,
    finishedAt,
    durationMs,
    projectRef: args.projectRef,
    projectName: args.projectName,
    tableCount: tables.length,
    policyCount: policies.length,
    rlsEnabledTables: rlsEnabled,
    rlsDisabledTables: rlsDisabled,
    functionCount: functions.length,
    storageBucketCount: buckets.length,
    tables: sanitizedTables,
    policies: sanitizedPolicies,
    functions: sanitizedFunctions,
    storageBuckets: sanitizedBuckets,
    promptBlock,
    promptBlockChars: promptBlock.length,
  };
}

function buildSupabasePromptBlock(args: {
  projectRef: string;
  projectName?: string;
  tableCount: number;
  policyCount: number;
  rlsEnabled: number;
  rlsDisabled: number;
  functionCount: number;
  bucketCount: number;
  publicBuckets: string[];
  rlsDisabledTables: string[];
  sampleTables: string[];
  samplePolicies: string[];
  sampleFunctions: string[];
}): string {
  const lines: string[] = [];
  lines.push("\n\nSUPABASE BAĞLAMI:");
  lines.push(`- Proje: ${args.projectName ?? "(adsız)"} ref=${args.projectRef}`);
  lines.push(`- Tablo: ${args.tableCount} (RLS açık: ${args.rlsEnabled}, kapalı: ${args.rlsDisabled})`);
  lines.push(`- Policy: ${args.policyCount}`);
  lines.push(`- Function: ${args.functionCount}`);
  lines.push(`- Storage bucket: ${args.bucketCount}${args.publicBuckets.length ? ` (PUBLIC: ${args.publicBuckets.join(", ")})` : ""}`);
  if (args.rlsDisabledTables.length) {
    lines.push(`- RLS KAPALI tablolar: ${args.rlsDisabledTables.slice(0, 20).join(", ")}${args.rlsDisabledTables.length > 20 ? " …" : ""}`);
  }
  if (args.sampleTables.length) lines.push(`- Tablolar (ilk 30): ${args.sampleTables.join(", ")}`);
  if (args.samplePolicies.length) lines.push(`- Policy'ler (ilk 30):\n  ${args.samplePolicies.join("\n  ")}`);
  if (args.sampleFunctions.length) lines.push(`- Fonksiyonlar (ilk 30): ${args.sampleFunctions.join(", ")}`);
  lines.push("ÖNEMLİ: Yukarıdaki Supabase metadata'sı PROD veritabanından alındı. Kod ile DB tutarsızlığı görürsen (tabloda olmayan kolon, RLS kapalı kritik tablo, yetkisiz policy) bunu net bir risk olarak rapor et. Hassas veri / row içeriği bağlamda YOKTUR.");
  return lines.join("\n");
}
