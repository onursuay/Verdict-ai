// Audit context için env-driven limitler.
//
// Eski hard-code 80_000 / 25 dosya / 300 entry sınırları ARTIK YOK.
// Tüm sınırlar env üzerinden override edilebilir; default değerler aşağıdadır.
//
// Karakter sayımı UTF-16 length ile yapılır (string.length); token tahmini
// olarak 4 karakter ≈ 1 token sayılır (görselleştirme için yaklaşıktır).

function intEnv(name: string, fallback: number, min = 0, max = 5_000_000): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export const AUDIT_LIMITS = {
  // GitHub repo tree pagination tavanı (page başına 100). 5000 entry'lik repo'lar
  // için tek istekte yeterli; daha büyükse warning ile kesilir.
  githubTreeMaxEntries: intEnv("VERDICT_GITHUB_TREE_LIMIT", 5_000, 100, 100_000),
  // Tek dosya base64 decode sonrası kabul edilen karakter sayısı.
  githubFileChars: intEnv("VERDICT_GITHUB_FILE_CHARS", 40_000, 1_000, 500_000),
  // Tek auditte içeriği okunacak dosya sayısı (en yüksek skorlu N).
  githubFilesToRead: intEnv("VERDICT_GITHUB_FILES_TO_READ", 80, 5, 1_000),
  // Toplam Context Pack karakter bütçesi (tüm kaynaklar dahil).
  contextPackChars: intEnv("VERDICT_AUDIT_CONTEXT_CHARS", 200_000, 20_000, 1_000_000),
  // Hard ceiling: kullanıcı ayarı bunun üstüne çıkamaz.
  contextPackHardCeiling: intEnv("VERDICT_AUDIT_CONTEXT_HARD_CEILING", 300_000, 50_000, 1_000_000),
  // Local path okuma limitleri.
  localPathMaxFiles: intEnv("VERDICT_LOCAL_MAX_FILES", 200, 5, 5_000),
  localPathFileChars: intEnv("VERDICT_LOCAL_FILE_CHARS", 40_000, 1_000, 500_000),
  localPathMaxBytes: intEnv("VERDICT_LOCAL_MAX_BYTES", 5_000_000, 100_000, 100_000_000),
  // Supabase metadata sayım sınırları.
  supabaseMaxTables: intEnv("VERDICT_SUPABASE_MAX_TABLES", 200, 10, 2_000),
  supabaseMaxPolicies: intEnv("VERDICT_SUPABASE_MAX_POLICIES", 500, 10, 5_000),
  // Worker heartbeat fetch timeout (ms).
  workerFetchTimeoutMs: intEnv("VERDICT_WORKER_TIMEOUT_MS", 5_000, 500, 60_000),
  vercelFetchTimeoutMs: intEnv("VERDICT_VERCEL_TIMEOUT_MS", 8_000, 1_000, 60_000),
  supabaseFetchTimeoutMs: intEnv("VERDICT_SUPABASE_TIMEOUT_MS", 10_000, 1_000, 60_000),
} as const;

export function approxTokens(charLength: number): number {
  return Math.ceil(charLength / 4);
}
