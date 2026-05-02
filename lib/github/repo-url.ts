// GitHub URL parser. Sadece server-side kullanılır; sonuçta token taşımaz.
//
// Desteklenen formatlar:
//   - https://github.com/owner/repo
//   - https://github.com/owner/repo.git
//   - https://github.com/owner/repo/tree/<branch>
//   - https://github.com/owner/repo/tree/<branch>/<path>...
//   - https://github.com/owner/repo/blob/<branch>/<path>...
//   - github.com/owner/repo (protokol opsiyonel)
//   - git@github.com:owner/repo.git (SSH)

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SAFE_PATH = /^[A-Za-z0-9._\-/]+$/;

function stripTrailing(s: string): string {
  return s.replace(/\.git$/i, "").replace(/\/+$/, "");
}

export function parseGithubRepoUrl(input: string): ParsedRepoUrl {
  if (!input || typeof input !== "string") {
    throw new Error("GitHub URL boş.");
  }

  const raw = input.trim();
  let owner: string;
  let repo: string;
  let branch: string | undefined;
  let path: string | undefined;

  // SSH: git@github.com:owner/repo(.git)
  const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else {
    // HTTPS / protocol-less
    let normalized = raw;
    if (!/^https?:\/\//i.test(normalized) && normalized.startsWith("github.com")) {
      normalized = "https://" + normalized;
    }
    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      throw new Error("Geçersiz GitHub URL'si.");
    }
    if (!/^github\.com$/i.test(url.hostname)) {
      throw new Error("Yalnızca github.com URL'leri desteklenir.");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error("URL owner/repo bilgisini içermiyor.");
    }
    owner = segments[0];
    repo = stripTrailing(segments[1]);

    if (segments.length >= 4 && (segments[2] === "tree" || segments[2] === "blob")) {
      branch = segments[3];
      const rest = segments.slice(4).join("/");
      if (rest) path = rest;
    }
  }

  owner = stripTrailing(owner);
  repo = stripTrailing(repo);

  if (!SAFE_SEGMENT.test(owner)) throw new Error("Geçersiz owner adı.");
  if (!SAFE_SEGMENT.test(repo)) throw new Error("Geçersiz repo adı.");
  if (branch && !/^[A-Za-z0-9._\-/]+$/.test(branch)) throw new Error("Geçersiz branch adı.");
  if (path && !SAFE_PATH.test(path)) throw new Error("Geçersiz path.");

  return { owner, repo, branch, path };
}
