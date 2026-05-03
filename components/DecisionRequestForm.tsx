"use client";

import { useState, useRef, type ReactNode } from "react";
import { DecisionAttachment, DecisionRequest, ExpectedOutput, Priority, ProjectContext, RequestType } from "@/types/decision";

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
  Hata: "Hata Analizi",
  "Yeni Özellik": "Prompt",
  "Mimari Karar": "Teknik Plan",
  "UI/UX Kararı": "Teknik Plan",
  "API Entegrasyonu": "Teknik Plan",
  Güvenlik: "Teknik Plan",
  Diğer: "Karar",
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
  | "githubRepoUrl"
  | "localProjectPath"
  | "liveUrl"
  | "vercelProjectUrl"
  | "vpsHost"
  | "supabaseProjectUrl";

const CONNECTION_KEYS: ConnectionKey[] = [
  "githubRepoUrl", "localProjectPath", "liveUrl",
  "vercelProjectUrl", "vpsHost", "supabaseProjectUrl",
];

// Services with an OAuth-style connect step (step 1 shown)
// Others go directly to step 2 (manual input)
type OAuthConfig = {
  connectLabel: string;
  actionUrl: string;
  brandColor: string; // Tailwind border/bg classes for the connect button
};

const OAUTH_CONFIGS: Partial<Record<ConnectionKey, OAuthConfig>> = {
  githubRepoUrl: {
    connectLabel: "GitHub ile Bağlan",
    actionUrl: "https://github.com/login/oauth/authorize",
    brandColor: "border-slate-300/40 bg-slate-300/10 hover:bg-slate-300/15 text-slate-100",
  },
  vercelProjectUrl: {
    connectLabel: "Vercel ile Bağlan",
    actionUrl: "https://vercel.com/integrations",
    brandColor: "border-slate-300/40 bg-slate-300/10 hover:bg-slate-300/15 text-slate-100",
  },
  supabaseProjectUrl: {
    connectLabel: "Supabase ile Bağlan",
    actionUrl: "https://supabase.com/dashboard",
    brandColor: "border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/15 text-emerald-100",
  },
};

type WizardConfig = {
  title: string;
  step2Label: string;
  step2Placeholder: string;
  step2InputType?: "text" | "url";
};

const WIZARD_CONFIGS: Record<ConnectionKey, WizardConfig> = {
  githubRepoUrl: {
    title: "GitHub Reposunu Bağla",
    step2Label: "Repo URL",
    step2Placeholder: "https://github.com/onursuay/coinbot",
    step2InputType: "url",
  },
  liveUrl: {
    title: "Canlı Site URL Ekle",
    step2Label: "Canlı Site URL",
    step2Placeholder: "https://coin.onursuay.com",
    step2InputType: "url",
  },
  vercelProjectUrl: {
    title: "Vercel Projesini Bağla",
    step2Label: "Vercel Project URL",
    step2Placeholder: "https://vercel.com/onur-suay/coinbot",
    step2InputType: "url",
  },
  vpsHost: {
    title: "VPS / Worker Bağla",
    step2Label: "VPS / Worker Bilgisi",
    step2Placeholder: "root@72.62.146.159 veya Hostinger VPS, /opt/coinbot",
    step2InputType: "text",
  },
  localProjectPath: {
    title: "Lokal Projeyi Bağla",
    step2Label: "Lokal Proje Yolu",
    step2Placeholder: "/Users/onursuay/Desktop/Onur Suay/Web Siteleri/coinbot",
    step2InputType: "text",
  },
  supabaseProjectUrl: {
    title: "Supabase Projesini Bağla",
    step2Label: "Supabase Project URL",
    step2Placeholder: "https://supabase.com/dashboard/project/...",
    step2InputType: "url",
  },
};

type WizardState = {
  keyName: ConnectionKey;
  step: 1 | 2;
  inputValue: string;
};

type PromptModalConfig = {
  title: string;
  body: string;
  source: "vps" | "local";
};

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

type ActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
};

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-slate-500/50 bg-slate-700/55 text-slate-300",
  success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  danger: "border-red-300/30 bg-red-400/10 text-red-200",
  info: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
};

const ACTION_VARIANTS: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary: "border-emerald-300/70 bg-emerald-300 text-slate-950 hover:bg-emerald-200",
  secondary: "border-slate-500/55 bg-slate-800/70 text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100",
  danger: "border-red-300/35 bg-red-400/10 text-red-200 hover:border-red-300/60 hover:bg-red-400/15",
  ghost: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/55 hover:bg-cyan-400/15",
};

function stripGithubRepoSuffix(value: string): string {
  return value.replace(/\.git$/i, "").replace(/\/+$/, "");
}

function parseGithubFullName(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
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
  try {
    const url = new URL(input.trim());
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
  } catch { return false; }
}

function ActionButton({ children, onClick, variant = "secondary", disabled = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${ACTION_VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}

// Colored status dot: green = connected, red = not connected
function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
        connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400/70"
      }`}
    />
  );
}

export default function DecisionRequestForm({ onSubmit, isLoading }: DecisionRequestFormProps) {
  const [projectName, setProjectName] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("Yeni Özellik");
  const [priority, setPriority] = useState<Priority>("Orta");
  const [problem, setProblem] = useState("");
  const [repoRequired, setRepoRequired] = useState(false);
  const [attachments, setAttachments] = useState<DecisionAttachment[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext>({});
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [promptModal, setPromptModal] = useState<PromptModalConfig | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [preparedInstruction, setPreparedInstruction] = useState<"vps" | "local" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateContext = (key: keyof ProjectContext, value: string) => {
    setProjectContext((prev) => ({ ...prev, [key]: value, projectConnectionsUpdatedAt: new Date().toISOString() }));
  };

  const sanitizedContext = (): ProjectContext | undefined => {
    const trimmed: ProjectContext = {};
    CONNECTION_KEYS.forEach((key) => {
      const value = projectContext[key]?.trim();
      if (value) trimmed[key] = value;
    });
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
    return Object.keys(trimmed).length ? trimmed : undefined;
  };

  const hasAnyContext = CONNECTION_KEYS.some((key) => !!projectContext[key]?.trim());

  const applyContextValue = (key: ConnectionKey, rawValue: string) => {
    const value = rawValue.trim();
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: new Date().toISOString() };
      if (value) { next[key] = value; } else { delete next[key]; }
      if (key === "githubRepoUrl") {
        const fullName = parseGithubFullName(value);
        if (value) {
          next.githubConnectionStatus = fullName ? "connected" : "manual";
          if (fullName) { next.githubRepoFullName = fullName; } else { delete next.githubRepoFullName; }
        } else {
          delete next.githubConnectionStatus;
          delete next.githubRepoFullName;
        }
      }
      if (key === "liveUrl") {
        if (value) { next.liveUrlStatus = "not_checked"; } else { delete next.liveUrlStatus; }
      }
      return next;
    });
  };

  const clearContextKeys = (keys: Array<keyof ProjectContext>) => {
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: new Date().toISOString() };
      keys.forEach((key) => { delete next[key]; });
      return next;
    });
  };

  const openWizard = (keyName: ConnectionKey) => {
    // Services with OAuth config start at step 1; others go directly to step 2
    const hasOAuth = !!OAUTH_CONFIGS[keyName];
    setWizard({ keyName, step: hasOAuth ? 1 : 2, inputValue: projectContext[keyName] ?? "" });
  };

  const wizardConnectAndProceed = () => {
    if (!wizard) return;
    const oauth = OAUTH_CONFIGS[wizard.keyName];
    if (oauth?.actionUrl) {
      window.open(oauth.actionUrl, "_blank", "noopener,noreferrer");
    }
    setWizard((prev) => prev ? { ...prev, step: 2 } : prev);
  };

  const wizardBack = () => {
    setWizard((prev) => {
      if (!prev) return prev;
      const hasOAuth = !!OAUTH_CONFIGS[prev.keyName];
      return hasOAuth ? { ...prev, step: 1 } : null;
    });
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
    const vpsHost = projectContext.vpsHost?.trim();
    if (!vpsHost) return;
    setPreparedInstruction("vps");
    setCopiedPrompt(false);
    setPromptModal({
      title: "SSH Talimatı",
      source: "vps",
      body: `VPS/Worker bilgisini doğrula. Verilen bilgi: ${vpsHost}. Eğer SSH erişimin varsa worker runtime, docker container, env ve log durumunu kontrol et.`,
    });
  };

  const showLocalPrompt = () => {
    const localProjectPath = projectContext.localProjectPath?.trim();
    if (!localProjectPath) return;
    setPreparedInstruction("local");
    setCopiedPrompt(false);
    setPromptModal({
      title: "Claude Code Talimatı",
      source: "local",
      body: `Önce şu klasöre geç: ${localProjectPath}. pwd ve ls ile doğru proje olduğunu doğrula. Sonra kullanıcının karar talebine göre ilgili dosyaları analiz et.`,
    });
  };

  const copyPrompt = async () => {
    if (!promptModal?.body || !navigator.clipboard) return;
    await navigator.clipboard.writeText(promptModal.body);
    setCopiedPrompt(true);
  };

  const ALLOWED_TYPES = ["image/png","image/jpeg","image/webp","application/pdf","text/plain","application/json","text/markdown"];
  const TEXT_TYPES = ["text/plain", "application/json", "text/markdown"];
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const MAX_TEXT = 15000;

  const handleFiles = (files: File[]) => {
    const valid = files.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE);
    valid.forEach(f => {
      const base: DecisionAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: f.name, type: f.type, size: f.size, createdAt: new Date(),
      };
      const addIfRoom = (att: DecisionAttachment) =>
        setAttachments(prev => prev.length >= MAX_FILES ? prev : [...prev, att]);
      if (TEXT_TYPES.includes(f.type)) {
        const reader = new FileReader();
        reader.onload = (e) => addIfRoom({ ...base, contentText: (e.target?.result as string ?? "").slice(0, MAX_TEXT), analysisStatus: "content_extracted" });
        reader.onerror = () => addIfRoom({ ...base, analysisStatus: "error", contentSummary: "Dosya okunamadı." });
        reader.readAsText(f);
      } else if (f.type.startsWith("image/")) {
        const imgReader = new FileReader();
        imgReader.onload = (e) => addIfRoom({ ...base, dataUrl: e.target?.result as string ?? "", visionStatus: "ready", analysisStatus: "metadata_only", contentSummary: "Görsel backend tarafında analiz edilecek." });
        imgReader.onerror = () => addIfRoom({ ...base, analysisStatus: "error", visionStatus: "error", contentSummary: "Görsel okunamadı." });
        imgReader.readAsDataURL(f);
      } else if (f.type === "application/pdf") {
        addIfRoom({ ...base, analysisStatus: "unsupported", contentSummary: "PDF içerik analizi geçici olarak desteklenmiyor." });
      } else {
        addIfRoom({ ...base, analysisStatus: "unsupported" });
      }
    });
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  // Derived connection values
  const githubRepoUrl = projectContext.githubRepoUrl?.trim() ?? "";
  const githubRepoFullName = projectContext.githubRepoFullName?.trim() || parseGithubFullName(githubRepoUrl);
  const liveUrl = projectContext.liveUrl?.trim() ?? "";
  const liveUrlStatus = projectContext.liveUrlStatus ?? "not_checked";
  const vercelUrl = projectContext.vercelProjectUrl?.trim() ?? "";
  const vpsHost = projectContext.vpsHost?.trim() ?? "";
  const localProjectPath = projectContext.localProjectPath?.trim() ?? "";
  const supabaseUrl = projectContext.supabaseProjectUrl?.trim() ?? "";

  const repoNoticeItems = [
    repoRequired && !hasAnyContext ? "Kod analizi için en az bir proje bağlantısı ekleyin." : "",
    repoRequired && githubRepoUrl ? "GitHub bağlı. Kod dosyaları analiz sırasında okunur." : "",
    repoRequired && localProjectPath ? "Lokal proje yolu Claude Code görevlerine bağlam olarak eklenir." : "",
  ].filter(Boolean);

  const renderStatusBadge = (label: string, tone: BadgeTone) => (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]}`}>{label}</span>
  );

  const renderCard = ({
    icon, title, statusTone, connected, value, actions,
  }: {
    icon: string; title: string; statusTone: BadgeTone;
    connected: boolean; value?: string; actions: ReactNode;
  }) => (
    <div className="min-w-0 rounded-lg border border-slate-500/45 bg-[#202b40]/80 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-500/45 bg-slate-950/25 text-[11px] font-black tracking-wide text-emerald-100">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
            {renderStatusBadge(connected ? "Bağlı" : "Bağlı değil", statusTone)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <StatusDot connected={connected} />
            {connected && value && (
              <p className="truncate text-xs text-slate-400" title={value}>{value}</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  // Wizard step 2 live preview
  const renderWizardPreview = () => {
    if (!wizard) return null;
    const { keyName, inputValue } = wizard;
    const trimmed = inputValue.trim();
    if (!trimmed) return null;

    if (keyName === "githubRepoUrl") {
      const parsed = parseGithubFullName(trimmed);
      return parsed ? (
        <div className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-2.5">
          <p className="text-xs text-slate-400 mb-1">Tespit edilen repo</p>
          <p className="text-sm font-semibold text-emerald-100">{parsed}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-200">URL formatı çözümlenemedi — ham URL kaydedilecek</p>
        </div>
      );
    }

    if (keyName === "liveUrl") {
      return !isHttpUrl(trimmed) ? (
        <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-xs text-amber-200">Geçerli bir HTTP/HTTPS URL giriniz.</p>
        </div>
      ) : null;
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !problem.trim()) return;
    onSubmit({
      id: `req-${Date.now()}`,
      projectName: projectName.trim(),
      requestType, priority,
      problem: problem.trim(),
      expectedOutput: OUTPUT_BY_TYPE[requestType],
      repoRequired,
      createdAt: new Date(),
      status: "analyzing",
      attachments,
      projectContext: sanitizedContext(),
    });
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proje Adı */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Proje Adı</label>
        <input
          type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required
          className="w-full px-4 py-2.5 rounded-lg border border-slate-500/55 bg-[#202b40] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
        />
      </div>

      {/* Talep Tipi */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Talep Tipi</label>
        <div className="flex flex-wrap gap-2">
          {REQUEST_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setRequestType(type)}
              className={`px-3.5 py-1.5 rounded-full text-sm border font-medium transition cursor-pointer ${requestType === type ? "bg-gradient-to-r from-emerald-400 to-cyan-400 border-emerald-300 text-slate-950 shadow-sm" : "bg-slate-700/45 border-slate-500/55 text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 hover:bg-emerald-400/10"}`}
            >{type}</button>
          ))}
        </div>
      </div>

      {/* Öncelik */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Öncelik</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-lg text-sm border font-medium transition cursor-pointer ${priority === p ? PRIORITY_SELECTED[p] : PRIORITY_COLORS[p]}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Prompt</label>
        <textarea value={problem} onChange={(e) => { setProblem(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} required
          style={{ minHeight: "160px" }}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-500/55 bg-[#202b40] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition resize-none overflow-hidden"
        />
      </div>

      {/* Referans Dosyalar */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Referans Dosyalar
          <span className="ml-2 text-xs font-normal text-slate-500">İsteğe bağlı · En fazla 5 dosya · Dosya başı 10 MB</span>
        </label>
        <p className="text-xs text-slate-500 mb-3">Sorunu anlatan ekran görüntüsü, PDF, doküman veya görselleri ekleyin.</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-500/60 rounded-xl p-6 text-center cursor-pointer bg-[#202b40]/70 hover:border-emerald-300/45 hover:bg-emerald-400/10 transition"
        >
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

      {/* Repo Gerekli Toggle */}
      <div className="flex items-center gap-3 p-4 bg-slate-700/45 rounded-lg border border-slate-500/45">
        <button type="button" onClick={() => setRepoRequired(!repoRequired)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${repoRequired ? "bg-emerald-400" : "bg-slate-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${repoRequired ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-slate-300 flex items-center gap-2 flex-wrap">
          Kod deposu analizi gerekli
          <span className="text-slate-500 text-xs font-normal">AI karar verirken GitHub repo/kod bağlamı gerekiyorsa açın.</span>
        </span>
      </div>

      {/* Proje Bağlantıları */}
      {repoRequired && (
        <div className="space-y-4 rounded-lg border border-slate-500/45 bg-slate-700/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Proje Bağlantıları</h3>
            {hasAnyContext && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">Bağlam eklendi</span>
            )}
          </div>

          {repoNoticeItems.length > 0 && (
            <div className="space-y-2">
              {repoNoticeItems.map((notice) => (
                <div key={notice} className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{notice}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* GitHub */}
            {renderCard({
              icon: "GH", title: "GitHub",
              connected: !!githubRepoUrl,
              statusTone: !githubRepoUrl ? "neutral" : githubRepoFullName ? "success" : "danger",
              value: githubRepoFullName ?? githubRepoUrl,
              actions: !githubRepoUrl ? (
                <ActionButton variant="primary" onClick={() => openWizard("githubRepoUrl")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton onClick={() => openWizard("githubRepoUrl")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["githubRepoUrl", "githubConnectionStatus", "githubRepoFullName"])}>Kes</ActionButton>
              </>),
            })}

            {/* Canlı Site */}
            {renderCard({
              icon: "URL", title: "Canlı Site",
              connected: !!liveUrl,
              statusTone: !liveUrl ? "neutral" : liveUrlStatus === "valid" ? "success" : liveUrlStatus === "invalid" ? "danger" : "info",
              value: liveUrl,
              actions: !liveUrl ? (
                <ActionButton variant="primary" onClick={() => openWizard("liveUrl")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton variant="ghost" onClick={validateLiveUrl}>Doğrula</ActionButton>
                <ActionButton onClick={() => openWizard("liveUrl")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["liveUrl", "liveUrlStatus"])}>Kes</ActionButton>
              </>),
            })}

            {/* Vercel */}
            {renderCard({
              icon: "VC", title: "Vercel",
              connected: !!vercelUrl,
              statusTone: vercelUrl ? "info" : "neutral",
              value: vercelUrl,
              actions: !vercelUrl ? (
                <ActionButton variant="primary" onClick={() => openWizard("vercelProjectUrl")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton onClick={() => openWizard("vercelProjectUrl")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["vercelProjectUrl"])}>Kes</ActionButton>
              </>),
            })}

            {/* VPS */}
            {renderCard({
              icon: "VPS", title: "VPS / Worker",
              connected: !!vpsHost,
              statusTone: vpsHost ? "success" : "neutral",
              value: vpsHost,
              actions: !vpsHost ? (
                <ActionButton variant="primary" onClick={() => openWizard("vpsHost")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton variant="ghost" onClick={showVpsPrompt}>SSH Talimatı</ActionButton>
                <ActionButton onClick={() => openWizard("vpsHost")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["vpsHost"])}>Kes</ActionButton>
              </>),
            })}

            {/* Lokal Proje */}
            {renderCard({
              icon: "LP", title: "Lokal Proje",
              connected: !!localProjectPath,
              statusTone: localProjectPath ? "success" : "neutral",
              value: localProjectPath,
              actions: !localProjectPath ? (
                <ActionButton variant="primary" onClick={() => openWizard("localProjectPath")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton variant="ghost" onClick={showLocalPrompt}>Claude Code ile Aç</ActionButton>
                <ActionButton onClick={() => openWizard("localProjectPath")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["localProjectPath"])}>Kes</ActionButton>
              </>),
            })}

            {/* Supabase */}
            {renderCard({
              icon: "SB", title: "Supabase",
              connected: !!supabaseUrl,
              statusTone: supabaseUrl ? "info" : "neutral",
              value: supabaseUrl,
              actions: !supabaseUrl ? (
                <ActionButton variant="primary" onClick={() => openWizard("supabaseProjectUrl")}>Bağlan</ActionButton>
              ) : (<>
                <ActionButton onClick={() => openWizard("supabaseProjectUrl")}>Değiştir</ActionButton>
                <ActionButton variant="danger" onClick={() => clearContextKeys(["supabaseProjectUrl"])}>Kes</ActionButton>
              </>),
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={isLoading || !projectName.trim() || !problem.trim()}
        className="w-full py-3 px-6 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:from-slate-700 disabled:via-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-slate-950 disabled:text-slate-400 font-semibold rounded-xl transition-all text-sm tracking-wide cursor-pointer shadow-sm"
      >
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

    {/* Wizard Modal */}
    {wizard && (() => {
      const config = WIZARD_CONFIGS[wizard.keyName];
      const oauth = OAUTH_CONFIGS[wizard.keyName];
      const canSave = wizard.inputValue.trim().length > 0;
      const hasOAuth = !!oauth;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-500/45 bg-[#172033] shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">{config.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {wizard.step === 1 ? "Yetkilendirme" : "Bağlantı Bilgisi"}
                </p>
              </div>
              {hasOAuth && (
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${wizard.step === 1 ? "bg-emerald-400" : "bg-slate-600"}`} />
                  <span className={`h-2 w-2 rounded-full ${wizard.step === 2 ? "bg-emerald-400" : "bg-slate-600"}`} />
                </div>
              )}
            </div>

            {/* Step 1 — OAuth connect */}
            {wizard.step === 1 && oauth && (
              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={wizardConnectAndProceed}
                  className={`w-full rounded-lg border px-4 py-3.5 text-sm font-semibold transition cursor-pointer ${oauth.brandColor}`}
                >
                  {oauth.connectLabel} →
                </button>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => setWizard(null)}
                    className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
                    İptal
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Input */}
            {wizard.step === 2 && (
              <div className="px-5 pb-5">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{config.step2Label}</label>
                <input
                  autoFocus
                  type={config.step2InputType ?? "text"}
                  value={wizard.inputValue}
                  onChange={(e) => setWizard((prev) => prev ? { ...prev, inputValue: e.target.value } : prev)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canSave) wizardSave(); }}
                  placeholder={config.step2Placeholder}
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
                {renderWizardPreview()}
                <div className="mt-5 flex justify-end gap-2">
                  {hasOAuth ? (
                    <button type="button" onClick={wizardBack}
                      className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
                      ← Geri
                    </button>
                  ) : (
                    <button type="button" onClick={() => setWizard(null)}
                      className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
                      İptal
                    </button>
                  )}
                  <button type="button" onClick={wizardSave} disabled={!canSave}
                    className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-45 disabled:cursor-not-allowed">
                    Kaydet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })()}

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
            <button type="button" onClick={() => { setPromptModal(null); setPreparedInstruction(null); }}
              className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400">
              Kapat
            </button>
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
