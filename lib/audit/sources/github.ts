// GitHub kaynak okuyucu — buildRepoContext üzerine ince bir AuditSourceReport adapter'ı.
// Audit için yeni eklenen alanlar: rankedFileCount, fullContextFileCount, summarizedFileCount,
// excludedCriticalFiles. Pipeline buradan GithubSourceReport alır.

import { buildRepoContext } from "../../github/build-repo-context";
import { sanitizeString } from "../sanitize";
import type { GithubSourceReport, AuditMode } from "../types";

export interface RunGithubSourceArgs {
  selected: boolean;
  critical: boolean;
  githubRepoUrl?: string;
  problem?: string;
  requestType?: string;
  projectName?: string;
  mode?: AuditMode;
  // Mod'a özgü "kritik" dosya path desenleri (regex string). Eksikse boş.
  expectedCriticalPatterns?: string[];
}

export async function runGithubSource(args: RunGithubSourceArgs): Promise<GithubSourceReport> {
  const startedAt = new Date().toISOString();
  const base = {
    kind: "github" as const,
    selected: args.selected,
    critical: args.critical,
    detail: [] as string[],
    warnings: [] as string[],
    startedAt,
  };

  if (!args.selected) {
    return {
      ...base,
      status: "not_selected",
      summary: "GitHub kaynağı kullanıcı tarafından seçilmedi.",
    };
  }
  if (!args.githubRepoUrl?.trim()) {
    return {
      ...base,
      status: "error",
      summary: "GitHub seçildi ancak repo URL'si yok.",
      errorMessage: "GitHub repo URL'si bağlanmamış.",
      finishedAt: new Date().toISOString(),
    };
  }

  const t0 = Date.now();
  const built = await buildRepoContext({
    githubRepoUrl: args.githubRepoUrl,
    problem: args.problem,
    requestType: args.requestType,
    projectName: args.projectName,
  });
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;

  if (built.meta.errorMessage) {
    return {
      ...base,
      status: "error",
      summary: built.meta.errorMessage,
      errorMessage: built.meta.errorMessage,
      finishedAt,
      durationMs,
      warnings: built.meta.warnings ?? [],
      owner: built.meta.owner || undefined,
      repo: built.meta.repo || undefined,
      branch: built.meta.branch || undefined,
    };
  }

  // Kritik dosya kontrolü: beklenen pattern'ler arasında okunmayanlar var mı?
  const readPaths = new Set(built.meta.selectedFiles.map((f) => f.path));
  const excludedCriticalFiles: string[] = [];
  if (args.expectedCriticalPatterns?.length) {
    for (const p of args.expectedCriticalPatterns) {
      let re: RegExp;
      try { re = new RegExp(p); } catch { continue; }
      // Pattern eşleşen ama selectedFiles arasında olmayan dosyaları işaretle.
      // (Tree görmediğimiz için yalnızca ranking dışı kalanları tespit edebiliyoruz.)
      const matched = built.meta.selectedFiles.find((f) => re.test(f.path));
      if (!matched) excludedCriticalFiles.push(p);
    }
  }

  const promptBlock = sanitizeString(buildGithubPromptBlock(built.meta, built.contextText));

  return {
    ...base,
    status: "completed",
    summary: `GitHub: ${built.meta.owner}/${built.meta.repo}@${built.meta.branch}${built.meta.headCommit ? `#${built.meta.headCommit.slice(0, 7)}` : ""} — ${built.meta.selectedFiles.length} dosya okundu`,
    detail: [
      `Repo: ${built.meta.owner}/${built.meta.repo}`,
      `Branch: ${built.meta.branch}`,
      ...(built.meta.headCommit ? [`HEAD commit: ${built.meta.headCommit.slice(0, 7)}`] : []),
      `Okunan dosya: ${built.meta.selectedFiles.length}`,
      ...(built.meta.warnings.length ? [`Uyarılar: ${built.meta.warnings.length}`] : []),
    ],
    warnings: built.meta.warnings,
    finishedAt,
    durationMs,
    owner: built.meta.owner,
    repo: built.meta.repo,
    branch: built.meta.branch,
    ...(built.meta.headCommit ? { headCommit: built.meta.headCommit } : {}),
    rankedFileCount: built.meta.selectedFiles.length,
    readFileCount: built.meta.selectedFiles.length,
    fullContextFileCount: built.meta.selectedFiles.filter((f) => f.contentPreview && !f.reason.includes("özet")).length,
    summarizedFileCount: 0,
    excludedCriticalFiles,
    selectedFiles: built.meta.selectedFiles.map((f) => ({
      path: f.path,
      size: f.size,
      language: f.language,
      reason: f.reason,
      truncated: false,
      chars: f.contentPreview.length,
    })),
    promptBlock,
    promptBlockChars: promptBlock.length,
    treeEntryCount: undefined,
    treeTruncated: false,
  };

  function buildGithubPromptBlock(meta: typeof built.meta, contextText: string): string {
    if (!meta.selectedFiles.length || !contextText.trim()) {
      return `\n\nGITHUB KOD BAĞLAMI:\nGitHub repo bağlandı (${meta.owner}/${meta.repo} @ ${meta.branch}) ancak okunabilir alakalı dosya bulunamadı. Kod analizi sınırlıdır.`;
    }
    const fileList = meta.selectedFiles
      .map((f) => `- ${f.path} (${f.language}, ~${(f.size / 1024).toFixed(1)} KB)`)
      .join("\n");
    return `\n\nGITHUB KOD BAĞLAMI:\n- Repo: ${meta.owner}/${meta.repo}\n- Branch: ${meta.branch}\n- Seçilen dosyalar:\n${fileList}\n\nDosya içerikleri:\n${contextText}\n\nÖNEMLİ: Bu dosya içerikleri GitHub'dan okunmuştur. Kod analizi yaparken yalnızca burada görülen dosyalara dayan; görmediğin dosyalar hakkında kesin hüküm verme.`;
  }
}
