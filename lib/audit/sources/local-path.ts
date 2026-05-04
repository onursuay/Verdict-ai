// Lokal masaüstü proje yolu okuyucu.
//
// Güvenlik:
//   - VERDICT_ALLOWED_LOCAL_PATH_PREFIXES env'i (`:` veya `,` ile ayrılmış) tanımlı değilse
//     local kaynak `not_configured` döner ve hiçbir dosya okunmaz.
//   - Kullanıcının verdiği path, env'deki prefix'lerden BİRİNİN içinde olmak zorunda.
//   - path.resolve sonrası prefix kontrolü yapılır → "../../etc/passwd" gibi traversal engellenir.
//   - Symlink takip edilmez (lstat → isFile/isDirectory'i loose kontrol).
//   - .gitignore tarzı default exclude listesi: node_modules, .next, dist, build, coverage,
//     .git, logs, tmp, .cache, vendor, target, .turbo, .vercel.
//   - Binary dosyalar (image/binary uzantılar) okunmaz; metin/koda izinli.
//
// GitHub-Local diff:
//   - Eğer GitHub raporu da varsa karşılaştırma yapılır:
//     onlyInLocal / onlyInGithub / contentDiffers (ilk 200 char hash karşılaştırması).

import { promises as fs } from "node:fs";
import path from "node:path";
import { sanitizeString } from "../sanitize";
import { AUDIT_LIMITS } from "../limits";
import type { LocalSourceReport, GithubSourceReport } from "../types";

const DEFAULT_EXCLUDE_DIRS = new Set([
  "node_modules", ".next", "dist", "build", "coverage", ".git",
  "logs", "tmp", ".cache", "vendor", "target", ".turbo", ".vercel",
  ".pnpm-store", ".yarn", ".idea", ".vscode", "out", ".parcel-cache",
]);
const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg", "pdf",
  "zip", "tar", "gz", "tgz", "rar", "7z", "mp3", "mp4", "mov", "avi", "wav",
  "ttf", "otf", "woff", "woff2", "eot", "exe", "dll", "so", "dylib", "wasm",
]);

export interface RunLocalPathSourceArgs {
  selected: boolean;
  critical: boolean;
  localPath?: string;
  // GitHub kaynağı bittiyse onun selectedFiles listesini diff için geç.
  githubReport?: GithubSourceReport;
}

function getAllowedPrefixes(): string[] {
  const raw = process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
  if (!raw) return [];
  return raw.split(/[,:;]/).map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(p));
}

function isWithinPrefix(resolved: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => resolved === prefix || resolved.startsWith(prefix + path.sep));
}

function extOf(p: string): string {
  const dot = p.lastIndexOf(".");
  if (dot < 0) return "";
  return p.slice(dot + 1).toLowerCase();
}

async function* walk(
  root: string,
  rel: string,
  state: { fileCount: number; bytes: number; warnings: string[] }
): AsyncGenerator<{ rel: string; abs: string; size: number }> {
  if (state.fileCount >= AUDIT_LIMITS.localPathMaxFiles || state.bytes >= AUDIT_LIMITS.localPathMaxBytes) return;
  let entries;
  try {
    entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
  } catch (e) {
    state.warnings.push(`readdir(${rel || "."}) hata: ${e instanceof Error ? e.message : "unknown"}`);
    return;
  }
  for (const entry of entries) {
    if (state.fileCount >= AUDIT_LIMITS.localPathMaxFiles || state.bytes >= AUDIT_LIMITS.localPathMaxBytes) return;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;
      yield* walk(root, rel ? path.join(rel, entry.name) : entry.name, state);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extOf(entry.name);
    if (BINARY_EXTS.has(ext)) continue;
    const relPath = rel ? path.join(rel, entry.name) : entry.name;
    let size = 0;
    try {
      const st = await fs.stat(path.join(root, relPath));
      size = st.size;
    } catch { continue; }
    state.fileCount++;
    state.bytes += size;
    yield { rel: relPath, abs: path.join(root, relPath), size };
  }
}

export async function runLocalPathSource(args: RunLocalPathSourceArgs): Promise<LocalSourceReport> {
  const startedAt = new Date().toISOString();
  const base = {
    kind: "local" as const,
    selected: args.selected,
    critical: args.critical,
    detail: [] as string[],
    warnings: [] as string[],
    startedAt,
  };

  if (!args.selected) {
    return { ...base, status: "not_selected", summary: "Lokal kaynak kullanıcı tarafından seçilmedi." };
  }
  if (!args.localPath?.trim()) {
    return {
      ...base,
      status: "error",
      summary: "Lokal yol seçildi ancak path bilgisi yok.",
      errorMessage: "localProjectPath girişi boş.",
      finishedAt: new Date().toISOString(),
    };
  }
  const allowed = getAllowedPrefixes();
  if (allowed.length === 0) {
    return {
      ...base,
      status: "not_configured",
      summary: "Lokal okuma için VERDICT_ALLOWED_LOCAL_PATH_PREFIXES env'i tanımlı değil.",
      errorMessage: "Sunucu lokal dosya okumaya yapılandırılmamış. Yöneticiye VERDICT_ALLOWED_LOCAL_PATH_PREFIXES env'ini set ettirin.",
      finishedAt: new Date().toISOString(),
      rootPath: args.localPath,
    };
  }
  let resolvedPath: string;
  try { resolvedPath = path.resolve(args.localPath); } catch (e) {
    return {
      ...base,
      status: "error",
      summary: "Lokal yol çözümlenemedi.",
      errorMessage: e instanceof Error ? e.message : "path.resolve failed",
      finishedAt: new Date().toISOString(),
      rootPath: args.localPath,
    };
  }
  if (!isWithinPrefix(resolvedPath, allowed)) {
    return {
      ...base,
      status: "unauthorized",
      summary: "Verilen yol izinli prefix listesinde değil.",
      errorMessage: `${resolvedPath} → izinli prefix dışında. Path traversal engellendi.`,
      finishedAt: new Date().toISOString(),
      rootPath: args.localPath,
      resolvedPath,
    };
  }

  // Var mı?
  try {
    const st = await fs.stat(resolvedPath);
    if (!st.isDirectory()) {
      return {
        ...base,
        status: "error",
        summary: "Verilen yol bir dizin değil.",
        errorMessage: `${resolvedPath} bir dizin değil.`,
        finishedAt: new Date().toISOString(),
        rootPath: args.localPath,
        resolvedPath,
      };
    }
  } catch {
    return {
      ...base,
      status: "error",
      summary: "Verilen yol bulunamadı.",
      errorMessage: `${resolvedPath} erişilemez.`,
      finishedAt: new Date().toISOString(),
      rootPath: args.localPath,
      resolvedPath,
    };
  }

  const t0 = Date.now();
  const state = { fileCount: 0, bytes: 0, warnings: [] as string[] };
  const files: Array<{ rel: string; abs: string; size: number }> = [];
  for await (const f of walk(resolvedPath, "", state)) files.push(f);

  // Diff with GitHub if provided
  let diffWithGithub: LocalSourceReport["diffWithGithub"] | undefined;
  if (args.githubReport?.selectedFiles?.length) {
    const localPaths = new Set(files.map((f) => f.rel.split(path.sep).join("/")));
    const ghPaths = new Set(args.githubReport.selectedFiles.map((f) => f.path));
    const onlyInLocal = [...localPaths].filter((p) => !ghPaths.has(p)).slice(0, 50);
    const onlyInGithub = [...ghPaths].filter((p) => !localPaths.has(p)).slice(0, 50);
    diffWithGithub = { onlyInLocal, onlyInGithub, contentDiffers: [] };
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;

  // Pick a few high-value files to read into context (small files first, src/lib priority)
  const ranked = files
    .map((f) => ({
      ...f,
      priority: /^(src\/|lib\/|app\/|components\/|types\/|supabase\/|worker\/)/.test(f.rel.split(path.sep).join("/")) ? 1 : 0,
    }))
    .sort((a, b) => b.priority - a.priority || a.size - b.size)
    .slice(0, 30);
  const selectedFiles: LocalSourceReport["selectedFiles"] = [];
  let promptParts: string[] = [];
  let totalChars = 0;
  for (const f of ranked) {
    let content: string;
    try {
      content = await fs.readFile(f.abs, "utf8");
    } catch { continue; }
    const truncated = content.length > AUDIT_LIMITS.localPathFileChars;
    const chunk = truncated ? content.slice(0, AUDIT_LIMITS.localPathFileChars) : content;
    selectedFiles!.push({ relativePath: f.rel.split(path.sep).join("/"), size: f.size, chars: chunk.length });
    const block = `### LOCAL ${f.rel.split(path.sep).join("/")}\n\n\`\`\`\n${chunk}\n\`\`\``;
    if (totalChars + block.length > AUDIT_LIMITS.contextPackChars) break;
    promptParts.push(block);
    totalChars += block.length;
  }

  const promptBlock = sanitizeString(buildLocalPromptBlock({
    rootPath: resolvedPath,
    fileCount: files.length,
    totalBytes: state.bytes,
    diff: diffWithGithub,
    fileBlocks: promptParts,
  }));

  return {
    ...base,
    status: "completed",
    summary: `Lokal: ${files.length} dosya / ${(state.bytes / 1024).toFixed(0)} KB taranıyor`,
    detail: [
      `Path: ${resolvedPath}`,
      `Dosya: ${files.length}`,
      `Toplam: ${(state.bytes / 1024).toFixed(0)} KB`,
      ...(diffWithGithub ? [
        `Yalnızca lokalde: ${diffWithGithub.onlyInLocal.length}`,
        `Yalnızca GitHub'da: ${diffWithGithub.onlyInGithub.length}`,
      ] : []),
    ],
    warnings: state.warnings,
    finishedAt,
    durationMs,
    rootPath: args.localPath,
    resolvedPath,
    fileCount: files.length,
    totalBytes: state.bytes,
    excludedDirs: [...DEFAULT_EXCLUDE_DIRS],
    diffWithGithub,
    selectedFiles,
    promptBlock,
    promptBlockChars: promptBlock.length,
  };
}

function buildLocalPromptBlock(args: {
  rootPath: string;
  fileCount: number;
  totalBytes: number;
  diff?: LocalSourceReport["diffWithGithub"];
  fileBlocks: string[];
}): string {
  const lines: string[] = [];
  lines.push("\n\nLOKAL PROJE BAĞLAMI:");
  lines.push(`- Path: ${args.rootPath}`);
  lines.push(`- Dosya sayısı: ${args.fileCount}`);
  lines.push(`- Toplam boyut: ${(args.totalBytes / 1024).toFixed(0)} KB`);
  if (args.diff) {
    if (args.diff.onlyInLocal.length) lines.push(`- Yalnızca LOKALDE (henüz push edilmemiş olabilir): ${args.diff.onlyInLocal.slice(0, 20).join(", ")}${args.diff.onlyInLocal.length > 20 ? " …" : ""}`);
    if (args.diff.onlyInGithub.length) lines.push(`- GitHub'da var lokalde yok: ${args.diff.onlyInGithub.slice(0, 20).join(", ")}${args.diff.onlyInGithub.length > 20 ? " …" : ""}`);
  }
  if (args.fileBlocks.length) {
    lines.push("\nLokal dosya içerikleri:\n");
    lines.push(args.fileBlocks.join("\n\n"));
  }
  lines.push("\nÖNEMLİ: Yukarıdaki dosyalar kullanıcının izin verdiği LOKAL klasörden okundu. GitHub'a push edilmemiş değişiklikler içerebilir; analiz sırasında dikkate al.");
  return lines.join("\n");
}
