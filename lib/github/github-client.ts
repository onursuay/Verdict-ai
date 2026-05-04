// Server-side GitHub REST API client. Token sadece Authorization header'ında
// gider; URL'de veya yanıtta asla taşınmaz.
//
// Sadece okuma yapar; yazma/PR/işlem yetkisi gerektirmez.

import { AUDIT_LIMITS } from "../audit/limits";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "verdict-ai/1.0";

// Env-driven limitler. Eski hard-code 300/25/20K/80K değerleri ARTIK YOK.
// Default'lar: 5000 entry tree, 80 dosya, 40K char/file, 200K char/audit.
export const FILE_TREE_LIMIT = AUDIT_LIMITS.githubTreeMaxEntries;
export const FILES_TO_READ_LIMIT = AUDIT_LIMITS.githubFilesToRead;
export const FILE_CONTENT_CHAR_LIMIT = AUDIT_LIMITS.githubFileChars;
export const TOTAL_CONTEXT_CHAR_LIMIT = AUDIT_LIMITS.contextPackChars;

// Binary / asset uzantıları — okumayı reddet.
const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg", "pdf",
  "zip", "tar", "gz", "tgz", "rar", "7z",
  "mp3", "mp4", "mov", "avi", "wav", "ogg",
  "ttf", "otf", "woff", "woff2", "eot",
  "exe", "dll", "so", "dylib", "wasm",
  "bin", "dat", "lock",
]);

// Code/text uzantıları — okumaya izinli.
const TEXT_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "yml", "yaml", "toml", "ini", "env",
  "md", "mdx", "txt",
  "py", "rb", "go", "rs", "java", "kt", "swift", "c", "h", "cpp", "hpp", "cc",
  "sql", "sh", "bash", "zsh", "ps1",
  "html", "htm", "css", "scss", "sass", "less",
  "xml", "graphql", "gql", "proto",
  "dockerfile",
  "example",
]);

export interface RepoTreeEntry {
  path: string;
  type: "blob" | "tree" | string;
  size?: number;
  sha?: string;
}

export interface FileContentResult {
  path: string;
  size: number;
  content: string;
  truncated: boolean;
  language: string;
}

export class GithubClientError extends Error {
  status: number;
  publicMessage: string;
  constructor(publicMessage: string, status: number) {
    super(publicMessage);
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function extOf(path: string): string {
  const base = path.split("/").pop() ?? "";
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function isLikelyTextFile(path: string, size?: number): boolean {
  const ext = extOf(path);
  if (BINARY_EXTS.has(ext)) return false;
  if (TEXT_EXTS.has(ext)) return true;
  // Bilinmeyen uzantı: küçük dosyaysa kabul et.
  if (typeof size === "number" && size > 0 && size <= 100_000) return true;
  return false;
}

export function languageOf(path: string): string {
  const ext = extOf(path);
  switch (ext) {
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "json": return "json";
    case "yml": case "yaml": return "yaml";
    case "md": case "mdx": return "markdown";
    case "sql": return "sql";
    case "py": return "python";
    case "go": return "go";
    case "rs": return "rust";
    case "sh": case "bash": case "zsh": return "shell";
    case "css": case "scss": case "sass": case "less": return "css";
    case "html": case "htm": return "html";
    case "dockerfile": return "dockerfile";
    case "env": case "example": return "ini";
    default: return ext || "text";
  }
}

async function ghFetch(url: string): Promise<Response> {
  return fetch(url, { headers: authHeaders(), cache: "no-store" });
}

function mapStatusToError(status: number, fallback: string): GithubClientError {
  if (status === 401) return new GithubClientError("GitHub kimlik doğrulaması başarısız oldu. Token geçersiz veya süresi dolmuş olabilir.", 401);
  if (status === 403) return new GithubClientError("GitHub erişimi reddedildi (rate limit veya yetersiz izin). Daha sonra tekrar deneyin veya GITHUB_TOKEN ekleyin.", 403);
  if (status === 404) return new GithubClientError("Repo, branch veya yol bulunamadı. Public mi, yoksa erişilebilir mi kontrol edin.", 404);
  if (status === 429) return new GithubClientError("GitHub rate limit aşıldı. Birkaç dakika sonra tekrar deneyin.", 429);
  return new GithubClientError(fallback, status);
}

// Default branch'i çek (URL'de branch yoksa).
async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const res = await ghFetch(url);
  if (!res.ok) throw mapStatusToError(res.status, "Repo bilgisi alınamadı.");
  const data = await res.json() as { default_branch?: string };
  if (!data.default_branch) throw new GithubClientError("Default branch bulunamadı.", 500);
  return data.default_branch;
}

export interface GetRepoTreeArgs {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface RepoTreeResult {
  owner: string;
  repo: string;
  branch: string;
  entries: RepoTreeEntry[];
  truncated: boolean;
  warnings: string[];
  // Branch HEAD commit SHA — Vercel production deploy commit ile eşleştirme için.
  headSha?: string;
}

// Branch HEAD commit SHA'sını çeker. Hata durumunda undefined döner; ana akışı
// kırmaz. Vercel productionCommitMatchesGithub karşılaştırması için kullanılır.
export async function getBranchHeadSha(owner: string, repo: string, branch: string): Promise<string | undefined> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`;
  try {
    const res = await ghFetch(url);
    if (!res.ok) return undefined;
    const data = await res.json() as { commit?: { sha?: string } };
    return data.commit?.sha;
  } catch { return undefined; }
}

// GitHub trees endpoint, tek istekte 100K SHA üst sınırına ulaşırsa
// truncated:true döner. Bu durumda her üst-seviye dizini ayrı tree çağrısıyla
// dolaşıp eksikleri doldururuz. Bu "pagination" görevini görür.
async function fetchSingleTree(owner: string, repo: string, ref: string, recursive: boolean): Promise<{ entries: RepoTreeEntry[]; truncated: boolean } | null> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}${recursive ? "?recursive=1" : ""}`;
  const res = await ghFetch(url);
  if (!res.ok) return null;
  const data = await res.json() as { tree?: Array<RepoTreeEntry & { sha: string }>; truncated?: boolean };
  return {
    entries: (data.tree ?? []).filter((e) => typeof e.path === "string"),
    truncated: !!data.truncated,
  };
}

export async function getRepoTree(args: GetRepoTreeArgs): Promise<RepoTreeResult> {
  const branch = args.branch ?? await getDefaultBranch(args.owner, args.repo);
  const url = `${GITHUB_API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  // Tree fetch ve HEAD SHA fetch paralel; SHA ana akışı kırmaz.
  const [res, headSha] = await Promise.all([
    ghFetch(url),
    getBranchHeadSha(args.owner, args.repo, branch),
  ]);
  if (!res.ok) throw mapStatusToError(res.status, "Repo dosya ağacı alınamadı.");
  const data = await res.json() as { tree?: Array<RepoTreeEntry & { sha: string }>; truncated?: boolean };
  const allEntries: Array<RepoTreeEntry & { sha?: string }> = (data.tree ?? []).filter((e) => typeof e.path === "string");
  const warnings: string[] = [];

  // Truncated → top-level subtree'leri ayrı ayrı recursive çek.
  if (data.truncated) {
    warnings.push("Repo dosya ağacı GitHub tarafından kısaltılmış; üst-seviye dizinler ek çağrılarla dolduruluyor.");
    const seenPaths = new Set(allEntries.map((e) => e.path));
    const topDirs = allEntries.filter((e) => e.type === "tree" && !e.path.includes("/"));
    for (const dir of topDirs) {
      if (!dir.sha) continue;
      const sub = await fetchSingleTree(args.owner, args.repo, dir.sha, true);
      if (!sub) continue;
      for (const child of sub.entries) {
        const fullPath = `${dir.path}/${child.path}`;
        if (seenPaths.has(fullPath)) continue;
        seenPaths.add(fullPath);
        allEntries.push({ ...child, path: fullPath });
      }
      if (sub.truncated) {
        warnings.push(`Üst-seviye dizin "${dir.path}" hala truncated; daha derin dizinler dahil edilmemiş olabilir.`);
      }
    }
  }

  let entries = allEntries.filter((e) => e.type === "blob");
  if (args.path) {
    const prefix = args.path.replace(/^\/+/, "").replace(/\/+$/, "") + "/";
    entries = entries.filter((e) => e.path === args.path || e.path.startsWith(prefix));
  }
  if (entries.length > FILE_TREE_LIMIT) {
    warnings.push(`Dosya ağacı ${entries.length} kayıt içeriyor; ilk ${FILE_TREE_LIMIT} ile sınırlandırıldı (env: VERDICT_GITHUB_TREE_LIMIT).`);
    entries = entries.slice(0, FILE_TREE_LIMIT);
  }
  return {
    owner: args.owner,
    repo: args.repo,
    branch,
    entries: entries.map(({ path, type, size, sha }) => ({ path, type, size, sha })),
    truncated: !!data.truncated,
    warnings,
    headSha,
  };
}

export interface GetFileContentArgs {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

export async function getFileContent(args: GetFileContentArgs): Promise<FileContentResult | null> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/contents/${args.filePath
    .split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(args.branch)}`;
  const res = await ghFetch(url);
  if (!res.ok) {
    // Tek dosya hatasında tüm akışı kırma; null dön.
    return null;
  }
  const data = await res.json() as {
    encoding?: string;
    content?: string;
    size?: number;
    type?: string;
  };
  if (data.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string") {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
  const truncated = decoded.length > FILE_CONTENT_CHAR_LIMIT;
  const content = truncated ? decoded.slice(0, FILE_CONTENT_CHAR_LIMIT) : decoded;
  return {
    path: args.filePath,
    size: typeof data.size === "number" ? data.size : decoded.length,
    content,
    truncated,
    language: languageOf(args.filePath),
  };
}
