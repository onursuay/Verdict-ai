"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { AuditSourceSelectionDTO, DecisionAttachment, DecisionRequest, ExpectedOutput, Priority, ProjectContext, RequestType } from "@/types/decision";

type AuditSourceKey = keyof AuditSourceSelectionDTO;
const AUDIT_SOURCE_KEYS: AuditSourceKey[] = ["github", "supabase", "vercel", "local", "worker"];
const AUDIT_SOURCE_LABEL: Record<AuditSourceKey, { code: string; title: string; subtitle: string }> = {
  github: { code: "GH", title: "GitHub Repo", subtitle: "Kod ağacı + dosya içerikleri" },
  supabase: { code: "SB", title: "Supabase", subtitle: "Schema, RLS, fn, storage metadata" },
  vercel: { code: "VC", title: "Vercel", subtitle: "Deploy, env key isimleri (değer yok)" },
  local: { code: "LP", title: "Lokal Proje Yolu", subtitle: "Push edilmemiş lokal dosyalar" },
  worker: { code: "VPS", title: "VPS / Worker", subtitle: "Heartbeat ve runtime" },
};
const AUDIT_SOURCES_DRAFT_KEY = "verdictai:audit-sources:v1";

function loadAuditSourcesDraft(): AuditSourceSelectionDTO | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUDIT_SOURCES_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuditSourceSelectionDTO>;
    return {
      github: !!parsed.github,
      supabase: !!parsed.supabase,
      vercel: !!parsed.vercel,
      local: !!parsed.local,
      worker: !!parsed.worker,
    };
  } catch { return null; }
}
function saveAuditSourcesDraft(sel: AuditSourceSelectionDTO) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(AUDIT_SOURCES_DRAFT_KEY, JSON.stringify(sel)); } catch {}
}

interface DecisionRequestFormProps {
  onSubmit: (request: DecisionRequest) => void;
  isLoading: boolean;
}

const REQUEST_TYPES: RequestType[] = [
  "Hata", "Yeni Özellik", "Mimari Karar", "UI/UX Kararı",
  "API Entegrasyonu", "Güvenlik", "Diğer",
];
const PRIORITIES: Priority[] = ["Düşük", "Orta", "Kritik"];
const OUTPUT_BY_TYPE: Record<RequestType, ExpectedOutput> = {
  Hata: "Hata Analizi", "Yeni Özellik": "Prompt", "Mimari Karar": "Teknik Plan",
  "UI/UX Kararı": "Teknik Plan", "API Entegrasyonu": "Teknik Plan",
  Güvenlik: "Teknik Plan", Diğer: "Karar",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  Düşük: "bg-emerald-400/10 border-emerald-300/25 text-emerald-200 hover:bg-emerald-400/15 hover:border-emerald-300/45",
  Orta: "bg-amber-400/10 border-amber-300/25 text-amber-200 hover:bg-amber-400/15 hover:border-amber-300/45",
  Kritik: "bg-red-400/10 border-red-300/25 text-red-200 hover:bg-red-400/15 hover:border-red-300/45",
};
const PRIORITY_SELECTED: Record<Priority, string> = {
  Düşük: "bg-gradient-to-r from-emerald-400 to-teal-400 border-emerald-300 text-slate-950 shadow-sm",
  Orta: "bg-amber-400 border-amber-300 text-slate-950 shadow-sm",
  Kritik: "bg-red-500 border-red-400 text-white shadow-sm",
};

type ConnectionKey =
  | "githubRepoUrl" | "localProjectPath" | "liveUrl"
  | "vercelProjectUrl" | "vpsHost" | "supabaseProjectUrl";

const CONNECTION_KEYS: ConnectionKey[] = [
  "githubRepoUrl", "localProjectPath", "liveUrl",
  "vercelProjectUrl", "vpsHost", "supabaseProjectUrl",
];

const PROJECT_CONTEXT_DRAFT_KEY = "verdictai:project-context:v1";
const PROJECT_CONTEXT_DRAFT_FIELDS: Array<keyof ProjectContext> = [
  "githubRepoUrl",
  "githubRepoFullName",
  "githubConnectionStatus",
  "liveUrl",
  "liveUrlStatus",
  "vercelProjectUrl",
  "vpsHost",
  "localProjectPath",
  "supabaseProjectUrl",
  "supabaseConnectionStatus",
  "supabaseProjectRef",
  "supabaseProjectName",
  "supabaseOrganizationId",
  "notes",
  "projectConnectionsUpdatedAt",
];

type ProjectContextDraft = {
  repoRequired: boolean;
  projectContext: ProjectContext;
};

function sanitizeProjectContextDraft(input: unknown): ProjectContext {
  const context: ProjectContext = {};
  if (!input || typeof input !== "object") return context;
  const raw = input as Record<string, unknown>;

  PROJECT_CONTEXT_DRAFT_FIELDS.forEach((key) => {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      (context as Record<keyof ProjectContext, string | undefined>)[key] = value.trim();
    }
  });

  if (!context.githubRepoUrl) {
    delete context.githubRepoFullName;
    delete context.githubConnectionStatus;
  }
  if (!context.liveUrl) {
    delete context.liveUrlStatus;
  }
  if (!context.supabaseProjectUrl && !context.supabaseProjectRef) {
    delete context.supabaseConnectionStatus;
    delete context.supabaseProjectName;
    delete context.supabaseOrganizationId;
  }

  return context;
}

function loadProjectContextDraft(): ProjectContextDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(PROJECT_CONTEXT_DRAFT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<ProjectContextDraft>;
    return {
      repoRequired: parsed.repoRequired === true,
      projectContext: sanitizeProjectContextDraft(parsed.projectContext),
    };
  } catch {
    return null;
  }
}

function saveProjectContextDraft(repoRequired: boolean, projectContext: ProjectContext) {
  if (typeof window === "undefined") return;
  const context = sanitizeProjectContextDraft(projectContext);
  if (!repoRequired && Object.keys(context).length === 0) {
    clearProjectContextDraft();
    return;
  }
  window.localStorage.setItem(
    PROJECT_CONTEXT_DRAFT_KEY,
    JSON.stringify({ repoRequired, projectContext: context })
  );
}

function clearProjectContextDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROJECT_CONTEXT_DRAFT_KEY);
}

type OAuthConnection = { label: string; connectedAt: string };
type OAuthConnections = {
  github?: OAuthConnection;
  vercel?: OAuthConnection;
  supabase?: OAuthConnection;
};

type EditableContextKey = Exclude<ConnectionKey, "githubRepoUrl">;

type WizardConfig = {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputType?: "text" | "url";
  multiline?: boolean;
};
const WIZARD_CONFIGS: Record<EditableContextKey, WizardConfig> = {
  liveUrl: {
    title: "Canlı Site URL",
    inputLabel: "URL",
    inputPlaceholder: "https://coin.onursuay.com",
    inputType: "url",
  },
  vercelProjectUrl: {
    title: "Vercel Project URL",
    inputLabel: "Proje URL",
    inputPlaceholder: "https://vercel.com/onur-suay/coinbot",
    inputType: "url",
  },
  vpsHost: {
    title: "VPS / Worker Bilgisi",
    inputLabel: "Host",
    inputPlaceholder: "root@72.62.146.159 veya Hostinger VPS, /opt/coinbot",
    inputType: "text",
  },
  localProjectPath: {
    title: "Lokal Proje Yolu",
    inputLabel: "Yol",
    inputPlaceholder: "/Users/onursuay/Desktop/Onur Suay/Web Siteleri/verdict_ai",
    inputType: "text",
  },
  supabaseProjectUrl: {
    title: "Supabase Project URL",
    inputLabel: "Proje URL",
    inputPlaceholder: "https://supabase.com/dashboard/project/...",
    inputType: "url",
  },
};

type WizardState = { keyName: EditableContextKey; inputValue: string };
type PromptModalConfig = { title: string; body: string; source: "vps" | "local" };
type GithubRepoItem = {
  fullName: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string | null;
};
type GithubRepoModalState = {
  loading: boolean;
  error: string | null;
  repos: GithubRepoItem[];
  query: string;
};
type SupabaseProjectItem = { ref: string; name: string; region: string; organization_id: string; created_at: string };
type SupabaseProjectModalState = { loading: boolean; error: string | null; projects: SupabaseProjectItem[] };
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
type ActionVariant = "primary" | "secondary" | "danger" | "ghost";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-slate-500/50 bg-slate-700/55 text-slate-300",
  success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  danger: "border-red-300/30 bg-red-400/10 text-red-200",
  info: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
};
const ACTION_VARIANTS: Record<ActionVariant, string> = {
  primary: "border-emerald-300/70 bg-emerald-300 text-slate-950 hover:bg-emerald-200",
  secondary: "border-slate-500/55 bg-slate-800/70 text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100",
  danger: "border-red-300/35 bg-red-400/10 text-red-200 hover:border-red-300/60 hover:bg-red-400/15",
  ghost: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/55 hover:bg-cyan-400/15",
};

function ConnectButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition cursor-pointer ${ACTION_VARIANTS.secondary}`}
    >
      {children}
    </button>
  );
}

function ConnectedChip({
  code,
  label,
  onEdit,
  onDisconnect,
  editLabel = "Değiştir",
  disconnectLabel = "Kes",
}: {
  code: string;
  label: string;
  onEdit?: () => void;
  onDisconnect: () => void;
  editLabel?: string;
  disconnectLabel?: "Kes" | "Sil";
}) {
  return (
    <div className="inline-flex h-9 max-w-full items-center overflow-hidden rounded-lg border border-emerald-300/35 bg-emerald-400/10 text-emerald-100">
      <div title={label} className="flex min-w-0 items-center gap-2 px-2.5 text-xs font-semibold">
        <span className="flex h-5 min-w-7 items-center justify-center rounded border border-emerald-300/30 bg-slate-950/25 px-1 text-[10px] font-black tracking-wide">
          {code}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="h-full border-l border-emerald-300/25 px-2 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/15 hover:text-emerald-100"
        >
          {editLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDisconnect}
        className="h-full border-l border-emerald-300/25 px-2 text-[11px] font-semibold text-emerald-200 transition hover:bg-red-400/15 hover:text-red-100"
      >
        {disconnectLabel}
      </button>
    </div>
  );
}


function stripGithubRepoSuffix(v: string) { return v.replace(/\.git$/i, "").replace(/\/+$/, ""); }
function parseGithubFullName(input: string): string | undefined {
  const raw = input.trim(); if (!raw) return undefined;
  const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) return `${stripGithubRepoSuffix(sshMatch[1])}/${stripGithubRepoSuffix(sshMatch[2])}`;
  let normalized = raw;
  if (!/^https?:\/\//i.test(normalized) && normalized.startsWith("github.com")) normalized = `https://${normalized}`;
  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return undefined;
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return undefined;
    return `${stripGithubRepoSuffix(owner)}/${stripGithubRepoSuffix(repo)}`;
  } catch { return undefined; }
}
function isHttpUrl(input: string): boolean {
  try { const u = new URL(input.trim()); return ["http:", "https:"].includes(u.protocol) && !!u.hostname; }
  catch { return false; }
}
function hostLabel(input: string): string {
  try { return new URL(input.trim()).hostname.replace(/^www\./, ""); }
  catch { return input.trim(); }
}
function pathLabel(input: string): string {
  const clean = input.trim().replace(/\/+$/, "");
  return clean.split("/").filter(Boolean).pop() || clean;
}
function vercelLabel(input: string): string {
  try {
    const url = new URL(input.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : hostLabel(input);
  } catch {
    return input.trim();
  }
}

export default function DecisionRequestForm({ onSubmit, isLoading }: DecisionRequestFormProps) {
  const [projectName, setProjectName] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("Yeni Özellik");
  const [priority, setPriority] = useState<Priority>("Orta");
  const [problem, setProblem] = useState("");
  const [repoRequired, setRepoRequired] = useState(false);
  const [attachments, setAttachments] = useState<DecisionAttachment[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext>({});
  const [auditSources, setAuditSources] = useState<AuditSourceSelectionDTO>({
    github: false, supabase: false, vercel: false, local: false, worker: false,
  });
  const [userTouchedAuditSources, setUserTouchedAuditSources] = useState(false);
  const [oauthConnections, setOauthConnections] = useState<OAuthConnections>({});
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [promptModal, setPromptModal] = useState<PromptModalConfig | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [githubRepoModal, setGithubRepoModal] = useState<GithubRepoModalState | null>(null);
  const [supabaseProjectModal, setSupabaseProjectModal] = useState<SupabaseProjectModalState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [vercelToast, setVercelToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    const draft = loadProjectContextDraft();
    if (draft) {
      setRepoRequired(draft.repoRequired);
      setProjectContext(draft.projectContext);
    }
    const auditDraft = loadAuditSourcesDraft();
    if (auditDraft) {
      setAuditSources(auditDraft);
      setUserTouchedAuditSources(true);
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    saveProjectContextDraft(repoRequired, projectContext);
  }, [draftLoaded, repoRequired, projectContext]);

  // Audit source default'ları: kullanıcı manuel değiştirmediyse projectContext'e göre otomatik aç/kapa.
  useEffect(() => {
    if (!draftLoaded || userTouchedAuditSources) return;
    setAuditSources({
      github: !!projectContext.githubRepoUrl?.trim() && repoRequired,
      supabase: !!projectContext.supabaseProjectRef?.trim() && repoRequired,
      vercel: !!projectContext.vercelProjectUrl?.trim() && repoRequired,
      local: !!projectContext.localProjectPath?.trim() && repoRequired,
      worker: !!projectContext.vpsHost?.trim() && repoRequired,
    });
  }, [draftLoaded, userTouchedAuditSources, repoRequired, projectContext.githubRepoUrl, projectContext.supabaseProjectRef, projectContext.vercelProjectUrl, projectContext.localProjectPath, projectContext.vpsHost]);

  useEffect(() => {
    if (!draftLoaded) return;
    saveAuditSourcesDraft(auditSources);
  }, [draftLoaded, auditSources]);

  const toggleAuditSource = (key: AuditSourceKey) => {
    setUserTouchedAuditSources(true);
    setAuditSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!vercelToast || vercelToast.type !== "success") return;
    const timer = setTimeout(() => setVercelToast(null), 4000);
    return () => clearTimeout(timer);
  }, [vercelToast]);

  // Read all OAuth callback params on mount + restore from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let stored: OAuthConnections = {};
    try { const s = localStorage.getItem("verdict_oauth"); if (s) stored = JSON.parse(s); } catch {}

    let updated = { ...stored };
    let changed = false;

    if (params.get("github_connected") === "1") {
      updated.github = { label: params.get("github_login") ?? "", connectedAt: new Date().toISOString() };
      changed = true;
    }
    if (params.get("vercel_connected") === "1") {
      updated.vercel = { label: params.get("vercel_username") ?? "", connectedAt: new Date().toISOString() };
      changed = true;
      setVercelToast({ type: "success", text: "Vercel bağlantısı kuruldu." });
    }
    const vercelError = params.get("vercel_error");
    if (vercelError) {
      const vercelErrorMap: Record<string, string> = {
        missing_code: "Vercel bağlantısı başarısız: yetkilendirme kodu alınamadı.",
        not_configured: "Vercel OAuth yapılandırılmamış. Yöneticiye bildirin.",
        token_failed: "Vercel token alınamadı. Tekrar deneyin.",
        network: "Ağ hatası. Tekrar deneyin.",
      };
      setVercelToast({ type: "error", text: vercelErrorMap[vercelError] ?? "Vercel bağlantısı başarısız." });
    }
    if (params.get("supabase_connected") === "1") {
      updated.supabase = { label: params.get("supabase_org") ?? "", connectedAt: new Date().toISOString() };
      changed = true;
    }

    const supError = params.get("supabase_error");
    if (supError) {
      const map: Record<string, string> = {
        not_configured: "Supabase OAuth yapılandırılmamış. Yöneticiye bildirin.",
        encryption_missing: "Sunucu şifreleme anahtarı eksik. Yöneticiye bildirin.",
        state_mismatch: "Güvenlik doğrulaması başarısız (state). Tekrar deneyin.",
        missing_verifier: "PKCE verifier kayıp. Tekrar deneyin.",
        missing_session: "Oturum bilgisi kayıp. Tekrar deneyin.",
        token_failed: "Supabase token alınamadı. Tekrar deneyin.",
        storage_failed: "Bağlantı kaydedilemedi. Tekrar deneyin.",
        network: "Ağ hatası. Tekrar deneyin.",
      };
      setSupabaseError(map[supError] ?? "Supabase bağlantısı başarısız.");
    }

    if (changed || supError || vercelError) {
      try { localStorage.setItem("verdict_oauth", JSON.stringify(updated)); } catch {}
      window.history.replaceState({}, "", window.location.pathname);
    }
    setOauthConnections(updated);
  }, []);

  // Sync Supabase connection state from server (DB) on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/supabase/connection", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { connected: boolean; accountLabel?: string | null };
        if (cancelled) return;
        if (data.connected) {
          setOauthConnections((prev) => {
            const conn: OAuthConnection = {
              label: data.accountLabel ?? prev.supabase?.label ?? "",
              connectedAt: prev.supabase?.connectedAt ?? new Date().toISOString(),
            };
            const next = { ...prev, supabase: conn };
            try { localStorage.setItem("verdict_oauth", JSON.stringify(next)); } catch {}
            return next;
          });
        } else {
          setOauthConnections((prev) => {
            if (!prev.supabase) return prev;
            const next = { ...prev };
            delete next.supabase;
            try { localStorage.setItem("verdict_oauth", JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } catch { /* sessizce geç */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pick up Vercel connection set by Marketplace popup (via non-httpOnly cookie)
  useEffect(() => {
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : null;
    };
    const pendingUser = getCookie("vercel_pending_user");
    if (pendingUser) {
      // Clear the cookie
      document.cookie = "vercel_pending_user=; Max-Age=0; path=/";
      const conn: OAuthConnection = { label: pendingUser, connectedAt: new Date().toISOString() };
      setOauthConnections((prev) => {
        const next = { ...prev, vercel: conn };
        try { localStorage.setItem("verdict_oauth", JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, []);

  const disconnect = async (service: keyof OAuthConnections) => {
    setOauthConnections((prev) => { const next = { ...prev }; delete next[service]; return next; });
    try {
      const stored = localStorage.getItem("verdict_oauth");
      if (stored) {
        const obj: OAuthConnections = JSON.parse(stored);
        delete obj[service];
        localStorage.setItem("verdict_oauth", JSON.stringify(obj));
      }
    } catch {}
    if (service === "supabase") {
      await fetch("/api/supabase/connection", { method: "DELETE" });
    } else {
      await fetch(`/api/auth/${service}`, { method: "DELETE" });
    }
    if (service === "github") clearContextKeys(["githubRepoUrl", "githubConnectionStatus", "githubRepoFullName"]);
    if (service === "vercel") clearContextKeys(["vercelProjectUrl"]);
    if (service === "supabase") clearContextKeys([
      "supabaseProjectUrl",
      "supabaseProjectRef",
      "supabaseProjectName",
      "supabaseOrganizationId",
      "supabaseConnectionStatus",
    ]);
  };

  const applyContextValue = (key: EditableContextKey, rawValue: string) => {
    const value = rawValue.trim();
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: new Date().toISOString() };
      if (value) { next[key] = value; } else { delete next[key]; }
      if (key === "liveUrl") {
        if (value) { next.liveUrlStatus = "not_checked"; } else { delete next.liveUrlStatus; }
      }
      return next;
    });
  };

  const clearContextKeys = (keys: Array<keyof ProjectContext>) => {
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: new Date().toISOString() };
      keys.forEach((k) => { delete next[k]; });
      return next;
    });
  };

  const updateContext = (key: keyof ProjectContext, value: string) =>
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, [key]: value, projectConnectionsUpdatedAt: new Date().toISOString() };
      if (key === "githubRepoUrl") {
        const fullName = parseGithubFullName(value);
        next.githubConnectionStatus = value.trim() ? "manual" : "not_connected";
        if (fullName) {
          next.githubRepoFullName = fullName;
        } else {
          delete next.githubRepoFullName;
        }
      }
      if (key === "liveUrl") {
        next.liveUrlStatus = value.trim() ? "not_checked" : "invalid";
      }
      return next;
    });

  const sanitizedContext = (): ProjectContext | undefined => {
    const trimmed: ProjectContext = {};
    CONNECTION_KEYS.forEach((key) => { const v = projectContext[key]?.trim(); if (v) trimmed[key] = v; });
    const notes = projectContext.notes?.trim();
    if (notes) trimmed.notes = notes;
    const supRef = projectContext.supabaseProjectRef?.trim();
    const supName = projectContext.supabaseProjectName?.trim();
    const supOrg = projectContext.supabaseOrganizationId?.trim();
    if (supRef) trimmed.supabaseProjectRef = supRef;
    if (supName) trimmed.supabaseProjectName = supName;
    if (supOrg) trimmed.supabaseOrganizationId = supOrg;
    if (!Object.keys(trimmed).length) return undefined;
    if (trimmed.githubRepoUrl) {
      const status = projectContext.githubConnectionStatus?.trim();
      const fullName = projectContext.githubRepoFullName?.trim() || parseGithubFullName(trimmed.githubRepoUrl);
      if (status) trimmed.githubConnectionStatus = status as ProjectContext["githubConnectionStatus"];
      if (fullName) trimmed.githubRepoFullName = fullName;
    }
    if (trimmed.liveUrl) {
      const status = projectContext.liveUrlStatus?.trim();
      if (status) trimmed.liveUrlStatus = status as ProjectContext["liveUrlStatus"];
    }
    const updatedAt = projectContext.projectConnectionsUpdatedAt?.trim();
    if (updatedAt) trimmed.projectConnectionsUpdatedAt = updatedAt;
    if (oauthConnections.github) trimmed.githubConnectionStatus = "connected";
    if (oauthConnections.supabase) trimmed.supabaseConnectionStatus = "connected";
    return Object.keys(trimmed).length ? trimmed : undefined;
  };

  const openWizard = (keyName: EditableContextKey) =>
    setWizard({ keyName, inputValue: projectContext[keyName] ?? "" });

  const openGithubRepoModal = async () => {
    setFormWarning(null);
    setGithubRepoModal({ loading: true, error: null, repos: [], query: "" });
    try {
      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const data = (await res.json()) as {
        connected: boolean;
        repos?: GithubRepoItem[];
        error?: string;
      };

      if (!data.connected) {
        setOauthConnections((prev) => {
          if (!prev.github) return prev;
          const next = { ...prev };
          delete next.github;
          try { localStorage.setItem("verdict_oauth", JSON.stringify(next)); } catch {}
          return next;
        });
        setGithubRepoModal({
          loading: false,
          error: "GitHub repo listesi alınamadı; bağlantıyı yenile.",
          repos: [],
          query: "",
        });
        return;
      }

      if (!res.ok || data.error) {
        setGithubRepoModal({
          loading: false,
          error: "GitHub repo listesi alınamadı; bağlantıyı yenile.",
          repos: [],
          query: "",
        });
        return;
      }

      setGithubRepoModal({ loading: false, error: null, repos: data.repos ?? [], query: "" });
    } catch {
      setGithubRepoModal({
        loading: false,
        error: "GitHub repo listesi alınamadı; bağlantıyı yenile.",
        repos: [],
        query: "",
      });
    }
  };

  const selectGithubRepo = (repo: GithubRepoItem) => {
    setProjectContext((prev) => ({
      ...prev,
      githubRepoUrl: repo.htmlUrl,
      githubRepoFullName: repo.fullName,
      githubConnectionStatus: "connected",
      projectConnectionsUpdatedAt: new Date().toISOString(),
    }));
    setFormWarning(null);
    setGithubRepoModal(null);
  };

  const openSupabaseProjectModal = async () => {
    setSupabaseProjectModal({ loading: true, error: null, projects: [] });
    try {
      const res = await fetch("/api/supabase/projects", { cache: "no-store" });
      const data = (await res.json()) as { connected: boolean; projects: SupabaseProjectItem[]; error?: string };
      if (!data.connected) {
        setSupabaseProjectModal({ loading: false, error: "Supabase bağlantısı bulunamadı.", projects: [] });
        return;
      }
      if (data.error) {
        const errMsg = data.error === "token_expired"
          ? "Supabase erişim token'ı süresi doldu. Lütfen yeniden bağlanın."
          : data.error === "insufficient_scope"
            ? "Bu hesabın Supabase proje listesi okuma izni yok."
            : data.error === "rate_limit"
              ? "Supabase API rate limit'e ulaşıldı. Birkaç dakika sonra tekrar deneyin."
              : "Supabase API hatası.";
        setSupabaseProjectModal({ loading: false, error: errMsg, projects: [] });
        return;
      }
      setSupabaseProjectModal({ loading: false, error: null, projects: data.projects ?? [] });
    } catch {
      setSupabaseProjectModal({ loading: false, error: "Proje listesi alınamadı.", projects: [] });
    }
  };

  const selectSupabaseProject = (p: SupabaseProjectItem) => {
    setProjectContext((prev) => ({
      ...prev,
      supabaseProjectRef: p.ref,
      supabaseProjectName: p.name,
      supabaseOrganizationId: p.organization_id,
      supabaseProjectUrl: `https://supabase.com/dashboard/project/${p.ref}`,
      supabaseConnectionStatus: "connected",
      projectConnectionsUpdatedAt: new Date().toISOString(),
    }));
    setSupabaseProjectModal(null);
  };

  const wizardSave = () => {
    if (!wizard) return;
    applyContextValue(wizard.keyName, wizard.inputValue);
    setWizard(null);
  };

  const validateLiveUrl = () => {
    const value = projectContext.liveUrl?.trim();
    updateContext("liveUrlStatus", value && isHttpUrl(value) ? "valid" : "invalid");
  };

  const showVpsPrompt = () => {
    const vpsHost = projectContext.vpsHost?.trim(); if (!vpsHost) return;
    setCopiedPrompt(false);
    setPromptModal({ title: "SSH Talimatı", source: "vps",
      body: `VPS/Worker bilgisini doğrula. Verilen bilgi: ${vpsHost}. Eğer SSH erişimin varsa worker runtime, docker container, env ve log durumunu kontrol et.` });
  };
  const showLocalPrompt = () => {
    const localProjectPath = projectContext.localProjectPath?.trim(); if (!localProjectPath) return;
    setCopiedPrompt(false);
    setPromptModal({ title: "Claude Code Talimatı", source: "local",
      body: `Önce şu klasöre geç: ${localProjectPath}. pwd ve ls ile doğru proje olduğunu doğrula. Sonra kullanıcının karar talebine göre ilgili dosyaları analiz et.` });
  };
  const copyPrompt = async () => {
    if (!promptModal?.body || !navigator.clipboard) return;
    await navigator.clipboard.writeText(promptModal.body);
    setCopiedPrompt(true);
  };

  const ALLOWED_TYPES = ["image/png","image/jpeg","image/webp","application/pdf","text/plain","application/json","text/markdown"];
  const TEXT_TYPES = ["text/plain","application/json","text/markdown"];
  const MAX_FILES = 5; const MAX_SIZE = 10*1024*1024; const MAX_TEXT = 15000;

  const handleFiles = (files: File[]) => {
    files.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE).forEach(f => {
      const base: DecisionAttachment = { id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name, type: f.type, size: f.size, createdAt: new Date() };
      const add = (att: DecisionAttachment) => setAttachments(prev => prev.length >= MAX_FILES ? prev : [...prev, att]);
      if (TEXT_TYPES.includes(f.type)) {
        const r = new FileReader();
        r.onload = (e) => add({ ...base, contentText: (e.target?.result as string ?? "").slice(0, MAX_TEXT), analysisStatus: "content_extracted" });
        r.onerror = () => add({ ...base, analysisStatus: "error", contentSummary: "Dosya okunamadı." });
        r.readAsText(f);
      } else if (f.type.startsWith("image/")) {
        const r = new FileReader();
        r.onload = (e) => add({ ...base, dataUrl: e.target?.result as string ?? "", visionStatus: "ready", analysisStatus: "metadata_only", contentSummary: "Görsel backend tarafında analiz edilecek." });
        r.onerror = () => add({ ...base, analysisStatus: "error", visionStatus: "error", contentSummary: "Görsel okunamadı." });
        r.readAsDataURL(f);
      } else if (f.type === "application/pdf") {
        add({ ...base, analysisStatus: "unsupported", contentSummary: "PDF içerik analizi geçici olarak desteklenmiyor." });
      } else { add({ ...base, analysisStatus: "unsupported" }); }
    });
  };
  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  // Derived values
  const githubRepoUrl = projectContext.githubRepoUrl?.trim() ?? "";
  const githubRepoFullName = projectContext.githubRepoFullName?.trim() || parseGithubFullName(githubRepoUrl);
  const liveUrl = projectContext.liveUrl?.trim() ?? "";
  const liveUrlStatus = projectContext.liveUrlStatus ?? "not_checked";
  const vercelUrl = projectContext.vercelProjectUrl?.trim() ?? "";
  const vpsHost = projectContext.vpsHost?.trim() ?? "";
  const localProjectPath = projectContext.localProjectPath?.trim() ?? "";
  const supabaseUrl = projectContext.supabaseProjectUrl?.trim() ?? "";
  const supabaseProjectRef = projectContext.supabaseProjectRef?.trim() ?? "";
  const supabaseProjectName = projectContext.supabaseProjectName?.trim() ?? "";
  // hasGithubUrl: repo URL gerçekten girilmiş → backend'e gidecek
  // hasGithubConnection: chip/display için (URL veya parsed fullName)
  // hasGithubOAuthOnly: OAuth bağlandı ama repo URL henüz girilmedi → uyarı durumu
  const hasGithubUrl = !!githubRepoUrl;
  const hasGithubConnection = hasGithubUrl || !!githubRepoFullName;
  const hasGithubOAuthOnly = !hasGithubConnection && !!oauthConnections.github;
  const hasVercelConnection = !!vercelUrl || !!oauthConnections.vercel;
  const hasSupabaseConnection = !!supabaseUrl || !!supabaseProjectRef || !!supabaseProjectName || !!oauthConnections.supabase;
  // connectedSourceCount: yalnızca URL/değer girilmiş kaynaklar sayılır.
  // OAuth-only (repo URL girmeden) kaynak sayımına girmez.
  const connectedSourceCount = [
    hasGithubUrl,
    !!liveUrl,
    hasVercelConnection,
    !!vpsHost,
    !!localProjectPath,
    hasSupabaseConnection,
  ].filter(Boolean).length;
  const hasAnyConnection = connectedSourceCount > 0;
  const selectedAuditCount = AUDIT_SOURCE_KEYS.filter((k) => auditSources[k]).length;
  const sourceCountLabel = repoRequired
    ? `${selectedAuditCount}/5 audit'e dahil`
    : hasAnyConnection ? `Bağlı kaynak: ${connectedSourceCount}` : "Bağlı kaynak yok";
  const analysisStateMessage = repoRequired
    ? hasGithubOAuthOnly
      ? "GitHub hesabı bağlı ancak repo seçilmedi. Kod bağlamı için repo seçin."
      : hasAnyConnection
        ? "Kod analizi açık. Bağlı kaynaklar analizde kullanılacak."
        : "Kod analizi açık ancak proje bağlantısı yok. AI yalnızca yazılı açıklama ve ek dosyaları analiz eder."
    : hasAnyConnection
      ? "Bağlantılar kayıtlı ancak bu analizde kullanılmayacak."
      : "Kod deposu analizi kapalı. Bağlantılar saklanır ancak bu analizde kullanılmaz.";

  const githubLabel = githubRepoFullName || parseGithubFullName(githubRepoUrl) || oauthConnections.github?.label || "GitHub bağlı";
  const liveLabel = liveUrl ? hostLabel(liveUrl) : "";
  const vercelSourceLabel = vercelUrl ? vercelLabel(vercelUrl) : oauthConnections.vercel?.label || "Vercel bağlı";
  const supabaseLabel = supabaseProjectName || supabaseProjectRef || (supabaseUrl ? pathLabel(supabaseUrl) : "") || oauthConnections.supabase?.label || "Supabase bağlı";

  // Wizard live preview
  const renderWizardPreview = () => {
    if (!wizard) return null;
    const { keyName, inputValue } = wizard;
    const trimmed = inputValue.trim(); if (!trimmed) return null;
    if (keyName === "liveUrl" && !isHttpUrl(trimmed))
      return <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
        <p className="text-xs text-amber-200">Geçerli bir HTTP/HTTPS URL giriniz.</p>
      </div>;
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !problem.trim()) return;
    if (repoRequired && hasGithubOAuthOnly) {
      setFormWarning("GitHub hesabı bağlı ancak repo seçilmedi. Kod bağlamı için repo seçin.");
      return;
    }
    setFormWarning(null);
    onSubmit({
      id: `req-${Date.now()}`, projectName: projectName.trim(), requestType, priority,
      problem: problem.trim(), expectedOutput: OUTPUT_BY_TYPE[requestType],
      repoRequired, createdAt: new Date(), status: "analyzing",
      attachments, projectContext: repoRequired ? sanitizedContext() : undefined,
      auditSources: repoRequired ? auditSources : undefined,
    });
  };

  // Source-specific availability for toggle disabled state
  const sourceAvailable = (key: AuditSourceKey): { enabled: boolean; reason?: string } => {
    switch (key) {
      case "github":
        return projectContext.githubRepoUrl?.trim()
          ? { enabled: true }
          : { enabled: false, reason: "GitHub repo URL'si bağlanmadı" };
      case "supabase":
        return projectContext.supabaseProjectRef?.trim() || projectContext.supabaseProjectUrl?.trim()
          ? { enabled: true }
          : { enabled: false, reason: "Supabase projesi bağlanmadı" };
      case "vercel":
        return oauthConnections.vercel || projectContext.vercelProjectUrl?.trim()
          ? { enabled: true }
          : { enabled: false, reason: "Vercel hesabı bağlı değil" };
      case "local":
        return projectContext.localProjectPath?.trim()
          ? { enabled: true }
          : { enabled: false, reason: "Lokal proje yolu girilmedi" };
      case "worker":
        return projectContext.vpsHost?.trim()
          ? { enabled: true }
          : { enabled: false, reason: "VPS / worker host bilgisi yok" };
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proje Adı */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Proje Adı</label>
        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required
          className="w-full px-4 py-2.5 rounded-lg border border-slate-500/55 bg-[#202b40] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition" />
      </div>

      {/* Talep Tipi */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Talep Tipi</label>
        <div className="flex flex-wrap gap-2">
          {REQUEST_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setRequestType(type)}
              className={`px-3.5 py-1.5 rounded-full text-sm border font-medium transition cursor-pointer ${requestType === type ? "bg-gradient-to-r from-emerald-400 to-cyan-400 border-emerald-300 text-slate-950 shadow-sm" : "bg-slate-700/45 border-slate-500/55 text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 hover:bg-emerald-400/10"}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Öncelik */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Öncelik</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-lg text-sm border font-medium transition cursor-pointer ${priority === p ? PRIORITY_SELECTED[p] : PRIORITY_COLORS[p]}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Prompt</label>
        <textarea value={problem} onChange={(e) => { setProblem(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} required
          style={{ minHeight: "160px" }}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-500/55 bg-[#202b40] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition resize-none overflow-hidden" />
      </div>

      {/* Referans Dosyalar */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Referans Dosyalar
          <span className="ml-2 text-xs font-normal text-slate-500">İsteğe bağlı · En fazla 5 dosya · Dosya başı 10 MB</span>
        </label>
        <p className="text-xs text-slate-500 mb-3">Sorunu anlatan ekran görüntüsü, PDF, doküman veya görselleri ekleyin.</p>
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-500/60 rounded-xl p-6 text-center cursor-pointer bg-[#202b40]/70 hover:border-emerald-300/45 hover:bg-emerald-400/10 transition">
          <p className="text-sm text-slate-400">Dosyaları buraya sürükleyin veya <span className="text-emerald-200 font-medium">seçmek için tıklayın</span></p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP, PDF, TXT, JSON, MD</p>
          <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,application/json,text/markdown" className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))} />
        </div>
        {attachments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 px-3 py-2 bg-slate-700/45 rounded-lg border border-slate-500/45 text-sm">
                <span className="text-emerald-200/80 flex-shrink-0">📎</span>
                <span className="truncate text-slate-200 font-medium flex-1">{att.name}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{att.type.split("/")[1]?.toUpperCase()}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{(att.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }} className="text-slate-500 hover:text-red-300 transition flex-shrink-0 cursor-pointer">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Beklenen Çıktı */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Beklenen Çıktı</label>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-500/45 bg-slate-700/45 text-sm text-slate-300 select-none">
          <span className="text-slate-500 text-xs">Otomatik:</span>
          <span className="font-medium text-emerald-100">{OUTPUT_BY_TYPE[requestType]}</span>
          <span className="ml-auto text-xs text-slate-500">Talep tipine göre belirlenir</span>
        </div>
      </div>

      {/* Repo Toggle */}
      <div className="rounded-lg border border-slate-500/45 bg-slate-700/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              aria-pressed={repoRequired}
              onClick={() => setRepoRequired(!repoRequired)}
              className={`mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${repoRequired ? "bg-emerald-400" : "bg-slate-600"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${repoRequired ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200">Kod deposu analizi gerekli</p>
              <p className={`mt-0.5 text-xs ${repoRequired ? "text-emerald-200" : "text-slate-400"}`}>
                {analysisStateMessage}
              </p>
            </div>
          </div>
          <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
            repoRequired || hasAnyConnection
              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
              : "border-slate-500/45 bg-slate-800/55 text-slate-300"
          }`}>
            {sourceCountLabel}
          </span>
        </div>
      </div>

      {/* Audit Kaynakları */}
      {repoRequired && (
        <div className="rounded-lg border border-slate-500/45 bg-slate-700/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Audit Kaynakları</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Bağla, düzenle ve hangi kaynakların audit&apos;e dahil edileceğini seç.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              {selectedAuditCount}/5 audit&apos;e dahil
            </span>
          </div>
          <ul className="space-y-2">
            {AUDIT_SOURCE_KEYS.map((key) => {
              const cfg = AUDIT_SOURCE_LABEL[key];
              const avail = sourceAvailable(key);
              const on = auditSources[key];
              return (
                <li key={key} className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 ${on && avail.enabled ? "border-emerald-300/35 bg-emerald-400/5" : "border-slate-500/45 bg-slate-800/40"}`}>
                  {/* Main row: toggle + code + name */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!avail.enabled}
                      onClick={() => avail.enabled && toggleAuditSource(key)}
                      className={`inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        !avail.enabled ? "bg-slate-700 cursor-not-allowed opacity-60" : on ? "bg-emerald-400 cursor-pointer" : "bg-slate-600 cursor-pointer"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className="flex h-7 min-w-[2.25rem] flex-shrink-0 items-center justify-center rounded border border-slate-500/45 bg-slate-900/45 px-1.5 text-[11px] font-black tracking-wide text-slate-200">
                      {cfg.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{cfg.title}</p>
                      <p className="truncate text-xs text-slate-400">
                        {avail.enabled ? cfg.subtitle : (avail.reason ?? cfg.subtitle)}
                      </p>
                    </div>
                  </div>
                  {/* Connection row: chip + action buttons */}
                  <div className="ml-[3.75rem] flex flex-wrap items-center gap-1.5">
                    {key === "github" && (
                      <>
                        {(hasGithubConnection || hasGithubOAuthOnly) ? (
                          <>
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 max-w-[14rem] truncate">
                              {hasGithubConnection ? githubLabel : (oauthConnections.github?.label || "GitHub bağlı")}
                            </span>
                            <button type="button" onClick={openGithubRepoModal}
                              className="rounded border border-slate-500/45 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 transition cursor-pointer">
                              {hasGithubOAuthOnly ? "Repo Seç" : "Repo Değiştir"}
                            </button>
                            <button type="button"
                              onClick={() => oauthConnections.github ? disconnect("github") : clearContextKeys(["githubRepoUrl", "githubConnectionStatus", "githubRepoFullName"])}
                              className="rounded border border-slate-500/35 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-red-300/45 hover:text-red-200 transition cursor-pointer">
                              Kes
                            </button>
                          </>
                        ) : (
                          <ConnectButton onClick={() => { window.location.href = "/api/auth/github"; }}>GitHub Bağla</ConnectButton>
                        )}
                      </>
                    )}
                    {key === "supabase" && (
                      <>
                        {hasSupabaseConnection ? (
                          <>
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 max-w-[14rem] truncate">
                              {supabaseLabel}
                            </span>
                            <button type="button" onClick={oauthConnections.supabase ? openSupabaseProjectModal : () => openWizard("supabaseProjectUrl")}
                              className="rounded border border-slate-500/45 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 transition cursor-pointer">
                              Değiştir
                            </button>
                            <button type="button"
                              onClick={() => oauthConnections.supabase ? disconnect("supabase") : clearContextKeys(["supabaseProjectUrl", "supabaseProjectRef", "supabaseProjectName", "supabaseOrganizationId", "supabaseConnectionStatus"])}
                              className="rounded border border-slate-500/35 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-red-300/45 hover:text-red-200 transition cursor-pointer">
                              Kes
                            </button>
                          </>
                        ) : (
                          <ConnectButton onClick={() => { window.location.href = "/api/auth/supabase"; }}>Supabase Bağla</ConnectButton>
                        )}
                      </>
                    )}
                    {key === "vercel" && (
                      <>
                        {(oauthConnections.vercel || vercelUrl) ? (
                          <>
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 max-w-[14rem] truncate">
                              {vercelUrl ? vercelSourceLabel : (oauthConnections.vercel?.label || "Vercel bağlı")}
                            </span>
                            <button type="button" onClick={() => openWizard("vercelProjectUrl")}
                              className="rounded border border-slate-500/45 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 transition cursor-pointer">
                              {vercelUrl ? "Proje Değiştir" : "Proje Ekle"}
                            </button>
                            <button type="button"
                              onClick={() => oauthConnections.vercel ? disconnect("vercel") : clearContextKeys(["vercelProjectUrl"])}
                              className="rounded border border-slate-500/35 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-red-300/45 hover:text-red-200 transition cursor-pointer">
                              Kes
                            </button>
                          </>
                        ) : (
                          <ConnectButton onClick={() => { window.location.href = "/api/auth/vercel"; }}>Vercel Bağla</ConnectButton>
                        )}
                      </>
                    )}
                    {key === "local" && (
                      <>
                        {localProjectPath ? (
                          <>
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 max-w-[14rem] truncate">
                              {pathLabel(localProjectPath)}
                            </span>
                            <button type="button" onClick={() => openWizard("localProjectPath")}
                              className="rounded border border-slate-500/45 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 transition cursor-pointer">
                              Değiştir
                            </button>
                            <button type="button" onClick={() => clearContextKeys(["localProjectPath"])}
                              className="rounded border border-slate-500/35 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-red-300/45 hover:text-red-200 transition cursor-pointer">
                              Kes
                            </button>
                          </>
                        ) : (
                          <ConnectButton onClick={() => openWizard("localProjectPath")}>Yol Ekle</ConnectButton>
                        )}
                      </>
                    )}
                    {key === "worker" && (
                      <>
                        {vpsHost ? (
                          <>
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 max-w-[14rem] truncate">
                              {vpsHost}
                            </span>
                            <button type="button" onClick={() => openWizard("vpsHost")}
                              className="rounded border border-slate-500/45 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 transition cursor-pointer">
                              Değiştir
                            </button>
                            <button type="button" onClick={() => clearContextKeys(["vpsHost"])}
                              className="rounded border border-slate-500/35 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:border-red-300/45 hover:text-red-200 transition cursor-pointer">
                              Kes
                            </button>
                          </>
                        ) : (
                          <ConnectButton onClick={() => openWizard("vpsHost")}>VPS Bağla</ConnectButton>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Seçilen kaynaklar paralel taranır. Toggle&apos;ı kapalı kaynaklar audit raporunda &quot;seçilmedi&quot; olarak işaretlenir, hata sayılmaz.
          </p>
        </div>
      )}

      {formWarning && (
        <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100">
          {formWarning}
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={isLoading || !projectName.trim() || !problem.trim()}
        className="w-full py-3 px-6 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:from-slate-700 disabled:via-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-slate-950 disabled:text-slate-400 font-semibold rounded-xl transition-all text-sm tracking-wide cursor-pointer shadow-sm">
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AI Analiz Yapıyor...
          </span>
        ) : "Analiz Başlat"}
      </button>
    </form>

    {/* Input Wizard Modal */}
    {wizard && (() => {
      const config = WIZARD_CONFIGS[wizard.keyName];
      const canSave = wizard.inputValue.trim().length > 0;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-500/45 bg-[#172033] shadow-2xl">
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-base font-semibold text-slate-100">{config.title}</h3>
            </div>
            <div className="px-5 pb-5">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{config.inputLabel}</label>
              {config.multiline ? (
                <textarea
                  autoFocus
                  value={wizard.inputValue}
                  onChange={(e) => setWizard((prev) => prev ? { ...prev, inputValue: e.target.value } : prev)}
                  placeholder={config.inputPlaceholder}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              ) : (
                <input autoFocus type={config.inputType ?? "text"} value={wizard.inputValue}
                  onChange={(e) => setWizard((prev) => prev ? { ...prev, inputValue: e.target.value } : prev)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canSave) wizardSave(); }}
                  placeholder={config.inputPlaceholder}
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20" />
              )}
              {renderWizardPreview()}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setWizard(null)}
                  className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
                  İptal
                </button>
                <button type="button" onClick={wizardSave} disabled={!canSave}
                  className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-45 disabled:cursor-not-allowed">
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* GitHub Repo Picker Modal */}
    {githubRepoModal && (() => {
      const query = githubRepoModal.query.trim().toLowerCase();
      const repos = query
        ? githubRepoModal.repos.filter((repo) => repo.fullName.toLowerCase().includes(query))
        : githubRepoModal.repos;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-500/45 bg-[#172033] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-500/35 px-5 pb-3 pt-5">
              <div>
                <h3 className="text-base font-semibold text-slate-100">GitHub Repo Seç</h3>
                <p className="mt-1 text-xs text-slate-500">Kod bağlamı seçilen repo üzerinden okunur.</p>
              </div>
              <button
                type="button"
                onClick={() => setGithubRepoModal(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4">
              <input
                type="text"
                value={githubRepoModal.query}
                onChange={(e) => setGithubRepoModal((prev) => prev ? { ...prev, query: e.target.value } : prev)}
                placeholder="Repo adı ara..."
                className="mb-3 w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />

              <div className="max-h-[56vh] overflow-y-auto">
                {githubRepoModal.loading && (
                  <p className="py-8 text-center text-sm text-slate-400">Repolar yükleniyor...</p>
                )}

                {!githubRepoModal.loading && githubRepoModal.error && (
                  <div className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
                    {githubRepoModal.error}
                  </div>
                )}

                {!githubRepoModal.loading && !githubRepoModal.error && githubRepoModal.repos.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">Erişilebilir GitHub reposu bulunamadı.</p>
                )}

                {!githubRepoModal.loading && !githubRepoModal.error && githubRepoModal.repos.length > 0 && repos.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">Aramaya uygun repo bulunamadı.</p>
                )}

                {!githubRepoModal.loading && !githubRepoModal.error && repos.length > 0 && (
                  <ul className="space-y-2">
                    {repos.map((repo) => (
                      <li key={repo.fullName}>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-500/45 bg-[#202b40] px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-100">{repo.fullName}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                repo.private
                                  ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
                                  : "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                              }`}>
                                {repo.private ? "private" : "public"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              default branch: <span className="font-mono text-slate-400">{repo.defaultBranch}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectGithubRepo(repo)}
                            className="flex-shrink-0 rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200"
                          >
                            Seç
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-500/35 px-5 py-3">
              <button
                type="button"
                onClick={() => setGithubRepoModal(null)}
                className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Supabase Project Picker Modal */}
    {supabaseProjectModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-500/45 bg-[#172033] shadow-2xl">
          <div className="px-5 pt-5 pb-3 border-b border-slate-500/35 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Supabase Projesi Seç</h3>
            <button type="button" onClick={() => setSupabaseProjectModal(null)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer">✕</button>
          </div>
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
            {supabaseProjectModal.loading && (
              <p className="text-sm text-slate-400 py-6 text-center">Projeler yükleniyor...</p>
            )}
            {!supabaseProjectModal.loading && supabaseProjectModal.error && (
              <div className="text-sm text-red-200 bg-red-400/10 border border-red-300/25 rounded-lg px-3 py-2.5">
                {supabaseProjectModal.error}
              </div>
            )}
            {!supabaseProjectModal.loading && !supabaseProjectModal.error && supabaseProjectModal.projects.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Bu Supabase hesabında proje bulunamadı.</p>
            )}
            {!supabaseProjectModal.loading && supabaseProjectModal.projects.length > 0 && (
              <ul className="space-y-2">
                {supabaseProjectModal.projects.map((p) => (
                  <li key={p.ref}>
                    <button type="button" onClick={() => selectSupabaseProject(p)}
                      className="w-full text-left rounded-lg border border-slate-500/45 bg-[#202b40] px-3 py-2.5 hover:border-emerald-300/55 hover:bg-emerald-400/5 transition cursor-pointer">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-slate-100 text-sm">{p.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{p.ref}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.region}{p.organization_id ? ` · org ${p.organization_id}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-500/35 flex justify-end">
            <button type="button" onClick={() => setSupabaseProjectModal(null)}
              className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
              Kapat
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Supabase error banner (URL params) */}
    {supabaseError && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
        <div className="rounded-lg border border-red-300/30 bg-[#2a1518] text-red-100 px-4 py-3 shadow-2xl flex items-start gap-3">
          <span className="text-red-300">⚠</span>
          <div className="flex-1 text-sm">{supabaseError}</div>
          <button type="button" onClick={() => setSupabaseError(null)}
            className="text-red-200 hover:text-red-100 cursor-pointer">✕</button>
        </div>
      </div>
    )}

    {/* Vercel toast (success/error) */}
    {vercelToast && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
        <div className={`rounded-lg border px-4 py-3 shadow-2xl flex items-start gap-3 ${
          vercelToast.type === "success"
            ? "border-emerald-300/30 bg-[#0f2318] text-emerald-100"
            : "border-red-300/30 bg-[#2a1518] text-red-100"
        }`}>
          <span className={vercelToast.type === "success" ? "text-emerald-300" : "text-red-300"}>
            {vercelToast.type === "success" ? "✓" : "⚠"}
          </span>
          <div className="flex-1 text-sm">{vercelToast.text}</div>
          <button type="button" onClick={() => setVercelToast(null)}
            className={`cursor-pointer ${vercelToast.type === "success" ? "text-emerald-200 hover:text-emerald-100" : "text-red-200 hover:text-red-100"}`}>✕</button>
        </div>
      </div>
    )}

    {/* Prompt Modal */}
    {promptModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
        <div className="w-full max-w-2xl rounded-xl border border-slate-500/45 bg-[#172033] p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">{promptModal.title}</h3>
              <p className="mt-1 text-xs text-emerald-200">Talimat hazırlandı.</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES["info"]}`}>
              {promptModal.source === "vps" ? "VPS" : "Claude Code"}
            </span>
          </div>
          <textarea readOnly value={promptModal.body} rows={6}
            className="w-full resize-none rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm leading-6 text-slate-100 focus:outline-none" />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPromptModal(null)}
              className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">Kapat</button>
            <button type="button" onClick={copyPrompt}
              className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
              {copiedPrompt ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
