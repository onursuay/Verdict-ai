// Secret / token / API key / private bilgi sanitize edici.
//
// Audit prompta veya rapora ham token akmasın diye TÜM kaynak çıktıları
// `sanitizeForPrompt` üzerinden geçer. Maskelenen tipler:
//   • GitHub tokens (ghp_, gho_, ghu_, ghs_, github_pat_)
//   • OpenAI keys (sk-...)
//   • Anthropic keys (sk-ant-...)
//   • Supabase service_role / anon keys (JWT formatında "eyJ" ile başlar)
//   • Generic JWT (3 base64-segment)
//   • AWS access keys (AKIA / ASIA + 16 hex)
//   • Bearer tokens, Authorization: Bearer ... header lines
//   • Private IP'ler (10/172.16/192.168/127) — VPS audit'inde
//   • Email adresleri parsial maskelenir (audit kullanıcı bağlamı için)
//
// NOT: Bu fonksiyonlar over-aggressive değildir; "olası secret" deseni gördüğünde
// `[REDACTED:<tip>]` ile yer değiştirir. Kod yapısı korunur.

const PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "github-pat", pattern: /\bghp_[A-Za-z0-9]{30,}/g },
  { name: "github-pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}/g },
  { name: "github-oauth", pattern: /\b(gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g },
  { name: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{30,}/g },
  { name: "google-api", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "vercel-token", pattern: /\b[A-Za-z0-9]{24}\b(?=[^A-Za-z0-9]|$)/g }, // çok generic; supabase ref'i etkilemesin diye context-aware
  { name: "aws-akia", pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/gi },
  { name: "supabase-service-role", pattern: /\bsbp_[A-Za-z0-9]{40,}\b/g },
];

// vercel-token desenini context-aware hale getir: env adı / token kelimesi yakınsa maskele
const CONTEXTUAL_TOKEN_NAMES = /(token|secret|password|api[_-]?key|service[_-]?role|access[_-]?key)/i;

// Tüm 4 octet'i kapsayan private IP regex'i.
const PRIVATE_IP_PATTERN = /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g;
const EMAIL_PATTERN = /\b([a-z0-9._%+-]{1,40})@([a-z0-9.-]+\.[a-z]{2,24})\b/gi;

function maskMatch(name: string): string {
  return `[REDACTED:${name}]`;
}

export function sanitizeString(input: string): string {
  if (!input) return input;
  let out = input;

  // generic patterns
  for (const { name, pattern } of PATTERNS) {
    if (name === "vercel-token") continue; // contextual handling below
    out = out.replace(pattern, () => maskMatch(name));
  }

  // contextual: 24-char alphanum runs only get masked if a token-name keyword is on the same line
  out = out
    .split("\n")
    .map((line) => {
      if (!CONTEXTUAL_TOKEN_NAMES.test(line)) return line;
      return line.replace(/\b[A-Za-z0-9_-]{24,}\b/g, (m) => {
        // exempt JWTs (already masked) and obvious paths/refs
        if (m.includes(":") || m.includes("/")) return m;
        return maskMatch("token-like");
      });
    })
    .join("\n");

  return out;
}

export function sanitizeObject<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value) as unknown as T;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeObject(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Anahtar adı suspect ise değeri tamamen maskele
      if (/^(access_token|refresh_token|service_role(_key)?|anon_key|api[_-]?key|secret|password|authorization)$/i.test(k)) {
        out[k] = "[REDACTED:value-by-key]";
      } else {
        out[k] = sanitizeObject(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

// Private IP'leri raporda maskelemek istediğimizde kullanılır (VPS host gibi).
export function maskPrivateIps(input: string): string {
  return input.replace(PRIVATE_IP_PATTERN, (ip) => {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
    return "[REDACTED:private-ip]";
  });
}

export function maskEmail(input: string): string {
  return input.replace(EMAIL_PATTERN, (_full, user: string, domain: string) => {
    if (user.length <= 2) return `*@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
  });
}
