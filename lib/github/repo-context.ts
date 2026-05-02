// Repo dosyalarına relevancy skoru verip en alakalı N tanesini seçen helper.
// Sadece path bazlı çalışır; dosya içeriği henüz indirilmemişken karar verir.

import {
  FILES_TO_READ_LIMIT,
  FILE_CONTENT_CHAR_LIMIT,
  TOTAL_CONTEXT_CHAR_LIMIT,
  type FileContentResult,
  type RepoTreeEntry,
  isLikelyTextFile,
  languageOf,
} from "./github-client";

export interface SelectedFileMeta {
  path: string;
  size: number;
  language: string;
  reason: string;
  contentPreview: string;
}

export interface BuiltContext {
  selectedFiles: SelectedFileMeta[];
  contextText: string;
  warnings: string[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "have", "about",
  "ile", "ama", "için", "veya", "olan", "olarak", "üzere", "değil", "şu", "bu",
  "bir", "iki", "üç", "var", "yok",
]);

// Anahtar kelime → sabit yol/regex skorları (0..N).
const KEYWORD_PATH_HINTS: Array<{ pattern: RegExp; tags: string[]; score: number }> = [
  { pattern: /\/risk[-_]?engine|risk\.ts|risk-tiers|risk-settings/i, tags: ["risk"], score: 6 },
  { pattern: /\/scanner|scan-modes|scanner\.ts/i, tags: ["scanner", "scan"], score: 6 },
  { pattern: /\/paper-trad|paper_trades|paper\.ts/i, tags: ["paper"], score: 6 },
  { pattern: /\/signal-engine|signal\.ts/i, tags: ["signal"], score: 6 },
  { pattern: /\/bot-orchestrator|orchestrator/i, tags: ["bot", "orchestrator"], score: 6 },
  { pattern: /\/aggressive|force-paper/i, tags: ["aggressive", "force"], score: 5 },
  { pattern: /\/opportunity/i, tags: ["opportunity"], score: 5 },
  { pattern: /\/api\//i, tags: ["api", "endpoint"], score: 4 },
  { pattern: /\/auth/i, tags: ["auth", "login", "session"], score: 5 },
  { pattern: /\/webhook/i, tags: ["webhook"], score: 5 },
  { pattern: /\/supabase|migrations\//i, tags: ["supabase", "db", "migration"], score: 4 },
  { pattern: /docker-compose|Dockerfile/i, tags: ["docker", "vps", "worker"], score: 4 },
  { pattern: /worker\//i, tags: ["worker", "vps"], score: 4 },
  { pattern: /components\//i, tags: ["ui", "component", "frontend"], score: 3 },
  { pattern: /tests?\//i, tags: ["test"], score: 3 },
  { pattern: /^README|^CLAUDE|^AGENTS|\.md$/i, tags: ["doc"], score: 2 },
  { pattern: /package\.json$/i, tags: ["deps"], score: 3 },
];

// CoinBot benzeri projelerde her zaman okunmaya çalışılacak yüksek-değer dosyalar.
const COINBOT_PRIORITY: RegExp[] = [
  /^src\/lib\/engines\/.+\.ts$/i,
  /^src\/lib\/risk-.+\.ts$/i,
  /^src\/lib\/aggressive.+\.ts$/i,
  /^src\/lib\/force-paper.+\.ts$/i,
  /^src\/lib\/opportunity.+\.ts$/i,
  /^src\/app\/api\/.+\/route\.ts$/i,
  /^worker\/.+\.ts$/i,
  /^docker-compose.+\.ya?ml$/i,
  /^supabase\/migrations\/.+\.sql$/i,
  /^src\/lib\/env\.ts$/i,
];

const GENERIC_PRIORITY: RegExp[] = [
  /^package\.json$/i,
  /^README\.md$/i,
  /^app\/api\/.+\/route\.ts$/i,
  /^src\/lib\/.+\.ts$/i,
  /^components\/.+\.tsx?$/i,
  /^types\/.+\.ts$/i,
  /^supabase\/.+\.sql$/i,
];

export interface RankFilesArgs {
  entries: RepoTreeEntry[];
  problem?: string;
  requestType?: string;
  projectName?: string;
}

export interface RankedFile {
  path: string;
  size: number;
  score: number;
  reasons: string[];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-zçğıöşü0-9]+/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function pathContainsToken(path: string, token: string): boolean {
  return path.toLowerCase().includes(token);
}

export function rankFiles(args: RankFilesArgs): RankedFile[] {
  const isCoinBot = /coinbot|coin[_\s-]?bot/i.test(args.projectName ?? "");
  const priorityList = isCoinBot ? [...COINBOT_PRIORITY, ...GENERIC_PRIORITY] : GENERIC_PRIORITY;

  const tokens = new Set<string>(tokenize(`${args.problem ?? ""} ${args.requestType ?? ""}`));

  const scored: RankedFile[] = [];

  for (const entry of args.entries) {
    if (!entry.path || entry.type !== "blob") continue;
    if (!isLikelyTextFile(entry.path, entry.size)) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1) Sabit path öncelikleri
    for (let i = 0; i < priorityList.length; i++) {
      if (priorityList[i].test(entry.path)) {
        const bonus = isCoinBot && i < COINBOT_PRIORITY.length ? 8 : 4;
        score += bonus;
        reasons.push(`öncelikli yol`);
        break;
      }
    }

    // 2) Anahtar kelime patern eşleşmeleri
    for (const hint of KEYWORD_PATH_HINTS) {
      if (hint.pattern.test(entry.path)) {
        const tagHit = hint.tags.some((t) => tokens.has(t));
        score += tagHit ? hint.score : Math.ceil(hint.score / 2);
        if (tagHit) reasons.push(`anahtar: ${hint.tags.find((t) => tokens.has(t))}`);
        else reasons.push(`konu: ${hint.tags[0]}`);
      }
    }

    // 3) Kullanıcı problem token'ları path içinde geçiyor mu?
    let tokenHits = 0;
    for (const t of tokens) {
      if (t.length < 4) continue;
      if (pathContainsToken(entry.path, t)) {
        tokenHits++;
        if (tokenHits <= 3) reasons.push(`metin: ${t}`);
      }
    }
    score += Math.min(tokenHits, 4) * 2;

    // 4) Ufak ceza: çok derin yol veya çok büyük dosya.
    const depth = entry.path.split("/").length;
    if (depth > 6) score -= 1;
    if ((entry.size ?? 0) > 200_000) score -= 2;

    if (score <= 0) continue;
    scored.push({ path: entry.path, size: entry.size ?? 0, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored;
}

export interface BuildContextTextArgs {
  files: FileContentResult[];
}

export function buildContextText({ files }: BuildContextTextArgs): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const parts: string[] = [];
  let total = 0;

  for (const f of files) {
    let chunk = f.content;
    if (f.truncated) {
      chunk += "\n\n…[içerik kırpıldı: dosya çok uzun]";
    }
    const fence = "```";
    const lang = f.language === "text" ? "" : f.language;
    const block = `### ${f.path}\nDil: ${f.language}\n\n${fence}${lang}\n${chunk}\n${fence}`;
    if (total + block.length > TOTAL_CONTEXT_CHAR_LIMIT) {
      warnings.push(`Toplam bağlam ${TOTAL_CONTEXT_CHAR_LIMIT} karakter sınırına ulaştı; bazı dosyalar prompt'a eklenmedi.`);
      break;
    }
    parts.push(block);
    total += block.length;
  }

  return { text: parts.join("\n\n"), warnings };
}

export const RELEVANCY_LIMITS = {
  filesToRead: FILES_TO_READ_LIMIT,
  fileChars: FILE_CONTENT_CHAR_LIMIT,
  totalChars: TOTAL_CONTEXT_CHAR_LIMIT,
};
