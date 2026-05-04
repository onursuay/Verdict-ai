// GitHub repo context'i tek seferde toplayan üst seviye yardımcı.
// Hem POST /api/github-context hem de /api/analyze tarafından kullanılır.
//
// Hata davranışı: ASLA throw ETMEZ. Tüm akışlar bir RepoContextSource döner;
// hata durumunda errorMessage doldurulur, selectedFiles boş kalır.

import { parseGithubRepoUrl } from "./repo-url";
import {
  getRepoTree,
  getFileContent,
  GithubClientError,
  type FileContentResult,
  FILES_TO_READ_LIMIT,
} from "./github-client";
import {
  rankFiles,
  buildContextText,
  type SelectedFileMeta,
} from "./repo-context";
import type { RepoContextSource } from "../../types/decision";

const PREVIEW_CHARS = 600;

export interface BuildRepoContextInput {
  githubRepoUrl: string;
  problem?: string;
  requestType?: string;
  projectName?: string;
}

export interface BuildRepoContextOutput {
  meta: RepoContextSource;
  contextText: string;
}

export async function buildRepoContext(input: BuildRepoContextInput): Promise<BuildRepoContextOutput> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];

  // 1) URL parse
  let parsed;
  try {
    parsed = parseGithubRepoUrl(input.githubRepoUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "URL ayrıştırılamadı.";
    return {
      meta: {
        source: "github",
        owner: "",
        repo: "",
        branch: "",
        selectedFiles: [],
        warnings: [],
        fetchedAt,
        errorMessage: msg,
      },
      contextText: "",
    };
  }

  // 2) Tree
  let treeRes;
  try {
    treeRes = await getRepoTree({
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch,
      path: parsed.path,
    });
  } catch (e) {
    const msg = e instanceof GithubClientError
      ? e.publicMessage
      : (e instanceof Error ? "GitHub bağlantı hatası." : "Bilinmeyen GitHub hatası.");
    return {
      meta: {
        source: "github",
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch ?? "",
        selectedFiles: [],
        warnings: [],
        fetchedAt,
        errorMessage: msg,
      },
      contextText: "",
    };
  }
  warnings.push(...treeRes.warnings);

  // 3) Skorla + en iyi N dosyayı seç
  const ranked = rankFiles({
    entries: treeRes.entries,
    problem: input.problem,
    requestType: input.requestType,
    projectName: input.projectName,
  });
  const top = ranked.slice(0, FILES_TO_READ_LIMIT);

  // 4) Dosya içeriklerini paralel çek (sınırlı concurrency için Promise.all
  // yeterli; 25 dosya × küçük blob, GitHub bunu rahat kaldırır).
  const contents: FileContentResult[] = [];
  await Promise.all(
    top.map(async (r) => {
      try {
        const file = await getFileContent({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: treeRes.branch,
          filePath: r.path,
        });
        if (file) contents.push(file);
      } catch {
        warnings.push(`Dosya okunamadı: ${r.path}`);
      }
    })
  );

  // Dosya bulunamayanlar veya text olmayanlar düşmüş olabilir; ranked sırasını koru.
  const orderMap = new Map(top.map((r, i) => [r.path, i]));
  contents.sort((a, b) => (orderMap.get(a.path) ?? 0) - (orderMap.get(b.path) ?? 0));

  // 5) Context metnini oluştur (toplam karakter sınırı uygulanır)
  const ctx = buildContextText({ files: contents });
  warnings.push(...ctx.warnings);

  // 6) Seçilen dosya meta listesi
  const selectedFiles: SelectedFileMeta[] = contents.map((c) => {
    const r = top.find((x) => x.path === c.path);
    return {
      path: c.path,
      size: c.size,
      language: c.language,
      reason: r?.reasons.join(", ") ?? "ilgili görüldü",
      contentPreview: c.content.slice(0, PREVIEW_CHARS),
    };
  });

  if (selectedFiles.length === 0) {
    warnings.push("Repo içinde alakalı text/code dosyası bulunamadı.");
  }

  return {
    meta: {
      source: "github",
      owner: parsed.owner,
      repo: parsed.repo,
      branch: treeRes.branch,
      selectedFiles,
      warnings,
      fetchedAt,
      ...(treeRes.headSha ? { headCommit: treeRes.headSha } : {}),
    },
    contextText: ctx.text,
  };
}
