// VPS / Worker heartbeat okuyucu.
//
// İki yol destekleniyor:
//   1) Supabase'de `worker_heartbeat` tablosu varsa son satırı oku (preferred).
//   2) VERDICT_WORKER_HEARTBEAT_URL env'i set ise oraya GET at, JSON parse et.
//
// Çıktı sanitizeObject ile maskelenir; SSH key, token, private IP gibi alanlar
// (yanlışlıkla yer alırsa) prompta ham aktarılmaz.

import { sanitizeObject, maskPrivateIps } from "../sanitize";
import { AUDIT_LIMITS } from "../limits";
import { getSupabaseServer } from "../../supabase-server";
import type { WorkerSourceReport } from "../types";

export interface RunWorkerSourceArgs {
  selected: boolean;
  critical: boolean;
  vpsHost?: string;
  // Supabase project'e heartbeat tablosu sorgusu için ek user_key gerektirmez;
  // VerdictAI'nin kendi Supabase server bağlantısı kullanılır.
}

interface HeartbeatRow {
  worker_id?: string;
  mode?: string;
  status?: string;
  last_error?: string | null;
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function runWorkerSource(args: RunWorkerSourceArgs): Promise<WorkerSourceReport> {
  const startedAt = new Date().toISOString();
  const base = {
    kind: "worker" as const,
    selected: args.selected,
    critical: args.critical,
    detail: [] as string[],
    warnings: [] as string[],
    startedAt,
  };

  if (!args.selected) {
    return { ...base, status: "not_selected", summary: "VPS/Worker kaynağı kullanıcı tarafından seçilmedi." };
  }

  const t0 = Date.now();
  let row: HeartbeatRow | null = null;
  let endpoint: string | undefined;

  // 1) Supabase tablosu (varsa)
  const supa = getSupabaseServer();
  if (supa) {
    try {
      const { data, error } = await supa
        .from("worker_heartbeat")
        .select("worker_id, mode, status, last_error, meta, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) row = data as HeartbeatRow;
    } catch { /* sessizce geç */ }
  }

  // 2) Env URL
  if (!row && process.env.VERDICT_WORKER_HEARTBEAT_URL) {
    endpoint = process.env.VERDICT_WORKER_HEARTBEAT_URL.trim();
    try {
      const res = await fetchWithTimeout(endpoint, AUDIT_LIMITS.workerFetchTimeoutMs);
      if (res.ok) {
        const data = (await res.json()) as HeartbeatRow;
        row = data;
      } else {
        return {
          ...base,
          status: res.status === 401 || res.status === 403 ? "unauthorized" : "error",
          summary: `Worker heartbeat HTTP ${res.status}`,
          errorMessage: `endpoint=${endpoint} returned ${res.status}`,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          endpoint,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network";
      return {
        ...base,
        status: msg.toLowerCase().includes("abort") ? "timeout" : "error",
        summary: `Worker heartbeat erişilemedi: ${msg}`,
        errorMessage: msg,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        endpoint,
      };
    }
  }

  if (!row) {
    return {
      ...base,
      status: "not_configured",
      summary: "Worker heartbeat kaynağı bulunamadı (Supabase tablosu yok ve VERDICT_WORKER_HEARTBEAT_URL set değil).",
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      endpoint,
    };
  }

  const lastTs = row.updated_at || row.created_at;
  const lastDate = lastTs ? new Date(lastTs) : null;
  const ageMs = lastDate ? Date.now() - lastDate.getTime() : undefined;
  const online = ageMs !== undefined ? ageMs < 5 * 60 * 1000 : false;

  const meta = sanitizeObject(row.meta ?? {});
  const lastError = row.last_error ? maskPrivateIps(row.last_error) : undefined;
  const finishedAt = new Date().toISOString();

  const promptBlock = buildWorkerPromptBlock({
    workerId: row.worker_id,
    runningMode: row.mode,
    status: row.status,
    lastHeartbeatAt: lastDate?.toISOString(),
    ageMs,
    online,
    lastError,
    vpsHost: args.vpsHost ? maskPrivateIps(args.vpsHost) : undefined,
  });

  return {
    ...base,
    status: "completed",
    summary: `Worker ${row.worker_id ?? "?"} • mode=${row.mode ?? "?"} • ${online ? "online" : "stale"}`,
    detail: [
      `Worker ID: ${row.worker_id ?? "?"}`,
      `Mode: ${row.mode ?? "?"}`,
      `Status: ${row.status ?? "?"}`,
      lastDate ? `Son heartbeat: ${lastDate.toISOString()} (${Math.round((ageMs ?? 0) / 1000)}s önce)` : "Heartbeat zamanı yok",
      lastError ? `Son hata: ${lastError}` : "Son hata yok",
    ],
    warnings: !online && ageMs !== undefined ? [`Heartbeat ${Math.round(ageMs / 1000)}s eski; worker offline veya stuck olabilir.`] : [],
    finishedAt,
    durationMs: Date.now() - t0,
    endpoint,
    workerId: row.worker_id,
    runningMode: row.mode,
    lastHeartbeatAt: lastDate?.toISOString(),
    ageMs,
    online,
    lastError,
    meta,
    promptBlock,
    promptBlockChars: promptBlock.length,
  };
}

function buildWorkerPromptBlock(args: {
  workerId?: string;
  runningMode?: string;
  status?: string;
  lastHeartbeatAt?: string;
  ageMs?: number;
  online: boolean;
  lastError?: string;
  vpsHost?: string;
}): string {
  const lines: string[] = [];
  lines.push("\n\nVPS / WORKER BAĞLAMI:");
  if (args.vpsHost) lines.push(`- Host: ${args.vpsHost} (private IP'ler maskelenmiştir)`);
  lines.push(`- Worker ID: ${args.workerId ?? "?"}`);
  lines.push(`- Mode: ${args.runningMode ?? "?"}`);
  lines.push(`- Status: ${args.status ?? "?"} (${args.online ? "ONLINE" : "OFFLINE/STALE"})`);
  if (args.lastHeartbeatAt) lines.push(`- Son heartbeat: ${args.lastHeartbeatAt} (${Math.round((args.ageMs ?? 0) / 1000)}s önce)`);
  if (args.lastError) lines.push(`- Son hata: ${args.lastError}`);
  lines.push("ÖNEMLİ: Worker offline veya çok eski heartbeat varsa, kodda doğru görünen davranış prod'da çalışmıyor olabilir.");
  return lines.join("\n");
}
