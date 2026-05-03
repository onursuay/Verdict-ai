"use client";

import { useState, useRef, type ReactNode } from "react";
import { DecisionAttachment, DecisionRequest, ExpectedOutput, Priority, ProjectContext, RequestType } from "@/types/decision";

interface DecisionRequestFormProps {
  onSubmit: (request: DecisionRequest) => void;
  isLoading: boolean;
}

const REQUEST_TYPES: RequestType[] = [
  "Hata",
  "Yeni Özellik",
  "Mimari Karar",
  "UI/UX Kararı",
  "API Entegrasyonu",
  "Güvenlik",
  "Diğer",
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

type PrimaryProjectContextKey =
  | "githubRepoUrl"
  | "localProjectPath"
  | "liveUrl"
  | "vercelProjectUrl"
  | "vpsHost"
  | "supabaseProjectUrl"
  | "notes";

type WizardState = {
  keyName: PrimaryProjectContextKey;
  step: 1 | 2;
  inputValue: string;
};

type WizardConfig = {
  title: string;
  label: string;
  placeholder: string;
  inputType?: "text" | "url";
  multiline?: boolean;
  step2Label: string;
};

const WIZARD_CONFIGS: Record<PrimaryProjectContextKey, WizardConfig> = {
  githubRepoUrl: {
    title: "GitHub Reposunu Bağla",
    label: "GitHub Repo URL",
    placeholder: "https://github.com/onursuay/coinbot",
    inputType: "url",
    step2Label: "Bağlantı önizlemesi",
  },
  liveUrl: {
    title: "Canlı Site URL Ekle",
    label: "Canlı Site URL",
    placeholder: "https://coin.onursuay.com",
    inputType: "url",
    step2Label: "URL önizlemesi",
  },
  vercelProjectUrl: {
    title: "Vercel URL Ekle",
    label: "Vercel Project URL",
    placeholder: "https://vercel.com/onur-suay/coinbot",
    inputType: "url",
    step2Label: "URL önizlemesi",
  },
  vpsHost: {
    title: "VPS / Worker Bilgisi Ekle",
    label: "VPS / Worker Bilgisi",
    placeholder: "Hostinger VPS, Docker worker, /opt/coinbot",
    inputType: "text",
    step2Label: "Bilgi önizlemesi",
  },
  localProjectPath: {
    title: "Lokal Proje Yolu Ekle",
    label: "Lokal Proje Yolu",
    placeholder: "/Users/onursuay/Desktop/Onur Suay/Web Siteleri/coinbot",
    inputType: "text",
    step2Label: "Yol önizlemesi",
  },
  supabaseProjectUrl: {
    title: "Supabase URL Ekle",
    label: "Supabase Project URL",
    placeholder: "https://supabase.com/dashboard/project/...",
    inputType: "url",
    step2Label: "URL önizlemesi",
  },
  notes: {
    title: "Ek Not Ekle",
    label: "Ek Not",
    placeholder: "Branch adı, deployment ortamı, kritik kısıtlar veya AI'a iletilmesi gereken diğer bağlam bilgisi...",
    multiline: true,
    step2Label: "Not önizlemesi",
  },
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
  title?: string;
};

const PRIMARY_CONTEXT_KEYS: PrimaryProjectContextKey[] = [
  "githubRepoUrl",
  "localProjectPath",
  "liveUrl",
  "vercelProjectUrl",
  "vpsHost",
  "supabaseProjectUrl",
  "notes",
];

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
  if (sshMatch) {
    return `${stripGithubRepoSuffix(sshMatch[1])}/${stripGithubRepoSuffix(sshMatch[2])}`;
  }

  let normalized = raw;
  if (!/^https?:\/\//i.test(normalized) && normalized.startsWith("github.com")) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return undefined;
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return undefined;
    return `${stripGithubRepoSuffix(owner)}/${stripGithubRepoSuffix(repo)}`;
  } catch {
    return undefined;
  }
}

function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
}

function ActionButton({ children, onClick, variant = "secondary", disabled = false, title }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${ACTION_VARIANTS[variant]}`}
    >
      {children}
    </button>
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
    setProjectContext((prev) => ({
      ...prev,
      [key]: value,
      projectConnectionsUpdatedAt: new Date().toISOString(),
    }));
  };

  const sanitizedContext = (): ProjectContext | undefined => {
    const trimmed: ProjectContext = {};
    PRIMARY_CONTEXT_KEYS.forEach((key) => {
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

  const hasAnyContext = PRIMARY_CONTEXT_KEYS.some((key) => !!projectContext[key]?.trim());

  const applyContextValue = (key: PrimaryProjectContextKey, rawValue: string) => {
    const value = rawValue.trim();
    const updatedAt = new Date().toISOString();

    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: updatedAt };

      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }

      if (key === "githubRepoUrl") {
        const fullName = parseGithubFullName(value);
        if (value) {
          next.githubConnectionStatus = fullName ? "connected" : "manual";
          if (fullName) {
            next.githubRepoFullName = fullName;
          } else {
            delete next.githubRepoFullName;
          }
        } else {
          delete next.githubConnectionStatus;
          delete next.githubRepoFullName;
        }
      }

      if (key === "liveUrl") {
        if (value) {
          next.liveUrlStatus = "not_checked";
        } else {
          delete next.liveUrlStatus;
        }
      }

      return next;
    });
  };

  const clearContextKeys = (keys: Array<keyof ProjectContext>) => {
    setProjectContext((prev) => {
      const next: ProjectContext = { ...prev, projectConnectionsUpdatedAt: new Date().toISOString() };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const openWizard = (keyName: PrimaryProjectContextKey) => {
    setWizard({
      keyName,
      step: 1,
      inputValue: projectContext[keyName] ?? "",
    });
  };

  const wizardNext = () => {
    if (!wizard || !wizard.inputValue.trim()) return;
    setWizard((prev) => prev ? { ...prev, step: 2 } : prev);
  };

  const wizardBack = () => {
    setWizard((prev) => prev ? { ...prev, step: 1 } : prev);
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
        name: f.name,
        type: f.type,
        size: f.size,
        createdAt: new Date(),
      };

      const addIfRoom = (att: DecisionAttachment) =>
        setAttachments(prev => prev.length >= MAX_FILES ? prev : [...prev, att]);

      if (TEXT_TYPES.includes(f.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string ?? "").slice(0, MAX_TEXT);
          addIfRoom({ ...base, contentText: text, analysisStatus: "content_extracted" });
        };
        reader.onerror = () =>
          addIfRoom({ ...base, analysisStatus: "error", contentSummary: "Dosya okunamadı." });
        reader.readAsText(f);
      } else if (f.type.startsWith("image/")) {
        const imgReader = new FileReader();
        imgReader.onload = (e) => {
          const dataUrl = e.target?.result as string ?? "";
          addIfRoom({
            ...base,
            dataUrl,
            visionStatus: "ready",
            analysisStatus: "metadata_only",
            contentSummary: "Görsel backend tarafında analiz edilecek.",
          });
        };
        imgReader.onerror = () =>
          addIfRoom({ ...base, analysisStatus: "error", visionStatus: "error", contentSummary: "Görsel okunamadı." });
        imgReader.readAsDataURL(f);
      } else if (f.type === "application/pdf") {
        addIfRoom({
          ...base,
          analysisStatus: "unsupported",
          contentSummary: "PDF içerik analizi geçici olarak desteklenmiyor. PDF içeriğini analiz ettirmek için metni TXT veya Markdown olarak ekleyin.",
        });
      } else {
        addIfRoom({ ...base, analysisStatus: "unsupported" });
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const githubRepoUrl = projectContext.githubRepoUrl?.trim() ?? "";
  const githubRepoFullName = projectContext.githubRepoFullName?.trim() || parseGithubFullName(githubRepoUrl);
  const githubStatus = !githubRepoUrl ? "Bağlı değil" : githubRepoFullName ? "Bağlı" : "Hata";
  const githubStatusTone: BadgeTone = !githubRepoUrl ? "neutral" : githubRepoFullName ? "success" : "danger";

  const liveUrl = projectContext.liveUrl?.trim() ?? "";
  const liveUrlStatus = projectContext.liveUrlStatus ?? "not_checked";
  const liveStatus = !liveUrl
    ? "Bağlı değil"
    : liveUrlStatus === "valid"
      ? "Doğrulandı"
      : liveUrlStatus === "invalid"
        ? "Erişilemiyor"
        : "Eklendi";
  const liveStatusTone: BadgeTone = !liveUrl
    ? "neutral"
    : liveUrlStatus === "valid"
      ? "success"
      : liveUrlStatus === "invalid"
        ? "danger"
        : "info";

  const vercelUrl = projectContext.vercelProjectUrl?.trim() ?? "";
  const vpsHost = projectContext.vpsHost?.trim() ?? "";
  const localProjectPath = projectContext.localProjectPath?.trim() ?? "";
  const supabaseUrl = projectContext.supabaseProjectUrl?.trim() ?? "";
  const notes = projectContext.notes?.trim() ?? "";

  const repoNoticeItems = [
    repoRequired && !hasAnyContext
      ? "Kod analizi için en az bir proje bağlantısı ekleyin. Aksi halde AI yalnızca yazılı açıklama ve ek dosyaları kullanır."
      : "",
    repoRequired && githubRepoUrl
      ? "GitHub bağlı. Kod dosyaları analiz sırasında okunur."
      : "",
    repoRequired && localProjectPath
      ? "Lokal proje yolu Claude Code görevlerine bağlam olarak eklenir."
      : "",
  ].filter(Boolean);

  const renderStatusBadge = (label: string, tone: BadgeTone) => (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]}`}>
      {label}
    </span>
  );

  const renderConnectionCard = ({
    icon,
    title,
    status,
    statusTone,
    value,
    actions,
  }: {
    icon: string;
    title: string;
    status: string;
    statusTone: BadgeTone;
    value: string;
    actions: ReactNode;
  }) => (
    <div className="min-w-0 rounded-lg border border-slate-500/45 bg-[#202b40]/80 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-500/45 bg-slate-950/25 text-[11px] font-black tracking-wide text-emerald-100">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
            {renderStatusBadge(status, statusTone)}
          </div>
          <p className="mt-1 truncate text-xs text-slate-400" title={value}>
            {value}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !problem.trim()) return;

    const request: DecisionRequest = {
      id: `req-${Date.now()}`,
      projectName: projectName.trim(),
      requestType,
      priority,
      problem: problem.trim(),
      expectedOutput: OUTPUT_BY_TYPE[requestType],
      repoRequired,
      createdAt: new Date(),
      status: "analyzing",
      attachments,
      projectContext: sanitizedContext(),
    };

    onSubmit(request);
  };

  // Wizard step 2 preview content
  const renderWizardStep2Preview = () => {
    if (!wizard) return null;
    const { keyName, inputValue } = wizard;
    const trimmed = inputValue.trim();

    if (keyName === "githubRepoUrl") {
      const parsed = parseGithubFullName(trimmed);
      return parsed ? (
        <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-3">
          <p className="text-xs text-slate-400 mb-1">Tespit edilen repo</p>
          <p className="text-sm font-semibold text-emerald-100">{parsed}</p>
          <p className="text-xs text-slate-500 mt-1 truncate">{trimmed}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 p-3">
          <p className="text-xs text-amber-200 font-medium">GitHub URL formatı çözümlenemedi</p>
          <p className="text-xs text-slate-400 mt-1">Ham URL analiz bağlamına eklenecek: <span className="text-slate-200">{trimmed}</span></p>
        </div>
      );
    }

    if (keyName === "liveUrl") {
      const valid = isHttpUrl(trimmed);
      return (
        <div className={`rounded-lg border p-3 ${valid ? "border-emerald-300/25 bg-emerald-400/10" : "border-amber-300/25 bg-amber-400/10"}`}>
          <p className="text-xs text-slate-400 mb-1">URL</p>
          <p className="text-sm text-slate-100 break-all">{trimmed}</p>
          {!valid && <p className="text-xs text-amber-200 mt-1.5">HTTP/HTTPS URL formatı bekleniyor.</p>}
        </div>
      );
    }

    if (keyName === "notes") {
      return (
        <div className="rounded-lg border border-slate-500/35 bg-slate-950/20 p-3">
          <p className="text-xs text-slate-400 mb-1">Not önizlemesi</p>
          <p className="text-sm text-slate-200 leading-5 whitespace-pre-wrap line-clamp-5">{trimmed}</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-slate-500/35 bg-slate-950/20 p-3">
        <p className="text-xs text-slate-400 mb-1">Kaydedilecek değer</p>
        <p className="text-sm text-slate-100 break-all">{trimmed}</p>
      </div>
    );
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proje Adı */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Proje Adı
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-slate-500/55 bg-[#202b40] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
        />
      </div>

      {/* Talep Tipi */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Talep Tipi
        </label>
        <div className="flex flex-wrap gap-2">
          {REQUEST_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setRequestType(type)}
              className={`px-3.5 py-1.5 rounded-full text-sm border font-medium transition cursor-pointer ${
                requestType === type
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400 border-emerald-300 text-slate-950 shadow-sm"
                  : "bg-slate-700/45 border-slate-500/55 text-slate-200 hover:border-emerald-300/45 hover:text-emerald-100 hover:bg-emerald-400/10"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Öncelik */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Öncelik
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-lg text-sm border font-medium transition cursor-pointer ${
                priority === p
                  ? PRIORITY_SELECTED[p]
                  : PRIORITY_COLORS[p]
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Prompt
        </label>
        <textarea
          value={problem}
          onChange={(e) => {
            setProblem(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          required
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
        <p className="text-xs text-slate-500 mb-3">
          Sorunu anlatan ekran görüntüsü, PDF, doküman veya görselleri ekleyin. AI analiz sırasında referans olarak kullanılır.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-500/60 rounded-xl p-6 text-center cursor-pointer bg-[#202b40]/70 hover:border-emerald-300/45 hover:bg-emerald-400/10 transition"
        >
          <p className="text-sm text-slate-400">Dosyaları buraya sürükleyin veya <span className="text-emerald-200 font-medium">seçmek için tıklayın</span></p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP, PDF, TXT, JSON, MD</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,application/json,text/markdown"
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {attachments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 px-3 py-2 bg-slate-700/45 rounded-lg border border-slate-500/45 text-sm">
                <span className="text-emerald-200/80 flex-shrink-0">📎</span>
                <span className="truncate text-slate-200 font-medium flex-1">{att.name}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{att.type.split("/")[1]?.toUpperCase()}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{(att.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                  className="text-slate-500 hover:text-red-300 transition flex-shrink-0 cursor-pointer"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Beklenen Çıktı — otomatik */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Beklenen Çıktı
        </label>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-500/45 bg-slate-700/45 text-sm text-slate-300 select-none">
          <span className="text-slate-500 text-xs">Otomatik:</span>
          <span className="font-medium text-emerald-100">{OUTPUT_BY_TYPE[requestType]}</span>
          <span className="ml-auto text-xs text-slate-500">Talep tipine göre belirlenir</span>
        </div>
      </div>

      {/* Repo Gerekli */}
      <div className="flex items-center gap-3 p-4 bg-slate-700/45 rounded-lg border border-slate-500/45">
        <button
          type="button"
          onClick={() => setRepoRequired(!repoRequired)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            repoRequired ? "bg-emerald-400" : "bg-slate-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              repoRequired ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-slate-300 flex items-center gap-2 flex-wrap">
          Kod deposu analizi gerekli
          <span className="text-slate-500 text-xs font-normal">
            AI karar verirken GitHub repo/kod bağlamı gerekiyorsa açın.
          </span>
        </span>
      </div>

      {/* Proje Bağlantıları — yalnızca repo toggle açıkken görünür */}
      {repoRequired && (
        <div className="space-y-4 rounded-lg border border-slate-500/45 bg-slate-700/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Proje Bağlantıları</h3>
            {hasAnyContext && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                Bağlam eklendi
              </span>
            )}
          </div>

          {repoNoticeItems.length > 0 && (
            <div className="space-y-2">
              {repoNoticeItems.map((notice) => (
                <div
                  key={notice}
                  className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
                >
                  {notice}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {renderConnectionCard({
              icon: "GH",
              title: "GitHub",
              status: githubStatus,
              statusTone: githubStatusTone,
              value: githubRepoUrl
                ? githubRepoFullName
                  ? githubRepoFullName
                  : githubRepoUrl
                : "Bağlantı yok",
              actions: (
                <>
                  {!githubRepoUrl ? (
                    <ActionButton variant="primary" onClick={() => openWizard("githubRepoUrl")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton onClick={() => openWizard("githubRepoUrl")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        onClick={() => clearContextKeys(["githubRepoUrl", "githubConnectionStatus", "githubRepoFullName"])}
                      >
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "URL",
              title: "Canlı Site",
              status: liveStatus,
              statusTone: liveStatusTone,
              value: liveUrl || "Bağlantı yok",
              actions: (
                <>
                  {!liveUrl ? (
                    <ActionButton variant="primary" onClick={() => openWizard("liveUrl")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton variant="ghost" onClick={validateLiveUrl}>
                        Doğrula
                      </ActionButton>
                      <ActionButton onClick={() => openWizard("liveUrl")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["liveUrl", "liveUrlStatus"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "VC",
              title: "Vercel",
              status: vercelUrl ? "Eklendi" : "Bağlantı yok",
              statusTone: vercelUrl ? "info" : "neutral",
              value: vercelUrl || "Bağlantı yok",
              actions: (
                <>
                  {!vercelUrl ? (
                    <ActionButton variant="primary" onClick={() => openWizard("vercelProjectUrl")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton onClick={() => openWizard("vercelProjectUrl")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["vercelProjectUrl"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "VPS",
              title: "VPS / Worker",
              status: vpsHost ? "Eklendi" : "Bağlantı yok",
              statusTone: vpsHost ? "success" : "neutral",
              value: vpsHost || "Bağlantı yok",
              actions: (
                <>
                  {!vpsHost ? (
                    <ActionButton variant="primary" onClick={() => openWizard("vpsHost")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton variant="ghost" onClick={showVpsPrompt}>
                        SSH Talimatı
                      </ActionButton>
                      <ActionButton onClick={() => openWizard("vpsHost")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["vpsHost"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "LP",
              title: "Lokal Proje",
              status: localProjectPath ? "Eklendi" : "Bağlantı yok",
              statusTone: localProjectPath ? "success" : "neutral",
              value: localProjectPath || "Bağlantı yok",
              actions: (
                <>
                  {!localProjectPath ? (
                    <ActionButton variant="primary" onClick={() => openWizard("localProjectPath")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton variant="ghost" onClick={showLocalPrompt}>
                        Claude Code ile Aç
                      </ActionButton>
                      <ActionButton onClick={() => openWizard("localProjectPath")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["localProjectPath"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "SB",
              title: "Supabase",
              status: supabaseUrl ? "Eklendi" : "Bağlantı yok",
              statusTone: supabaseUrl ? "info" : "neutral",
              value: supabaseUrl || "Bağlantı yok",
              actions: (
                <>
                  {!supabaseUrl ? (
                    <ActionButton variant="primary" onClick={() => openWizard("supabaseProjectUrl")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton onClick={() => openWizard("supabaseProjectUrl")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["supabaseProjectUrl"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}

            {renderConnectionCard({
              icon: "NOT",
              title: "Ek Not",
              status: notes ? "Eklendi" : "Not yok",
              statusTone: notes ? "info" : "neutral",
              value: notes ? notes.slice(0, 60) + (notes.length > 60 ? "…" : "") : "Bağlantı yok",
              actions: (
                <>
                  {!notes ? (
                    <ActionButton variant="primary" onClick={() => openWizard("notes")}>
                      Bağlan
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton onClick={() => openWizard("notes")}>
                        Değiştir
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => clearContextKeys(["notes"])}>
                        Kes
                      </ActionButton>
                    </>
                  )}
                </>
              ),
            })}
          </div>

          <details className="rounded-lg border border-slate-500/35 bg-slate-950/15 p-3">
            <summary className="cursor-pointer select-none text-xs font-semibold text-slate-300">
              Gelişmiş manuel düzenleme
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">GitHub Repo URL</label>
                <input
                  type="url"
                  value={projectContext.githubRepoUrl ?? ""}
                  onChange={(e) => updateContext("githubRepoUrl", e.target.value)}
                  placeholder="https://github.com/onursuay/coinbot"
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Lokal Proje Yolu</label>
                <input
                  type="text"
                  value={projectContext.localProjectPath ?? ""}
                  onChange={(e) => updateContext("localProjectPath", e.target.value)}
                  placeholder="/Users/onursuay/Desktop/Onur Suay/Web Siteleri/coinbot"
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Canlı Site URL</label>
                <input
                  type="url"
                  value={projectContext.liveUrl ?? ""}
                  onChange={(e) => updateContext("liveUrl", e.target.value)}
                  placeholder="https://coin.onursuay.com"
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Vercel Project URL</label>
                <input
                  type="url"
                  value={projectContext.vercelProjectUrl ?? ""}
                  onChange={(e) => updateContext("vercelProjectUrl", e.target.value)}
                  placeholder="https://vercel.com/onur-suay/coinbot"
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">VPS / Worker Bilgisi</label>
                <input
                  type="text"
                  value={projectContext.vpsHost ?? ""}
                  onChange={(e) => updateContext("vpsHost", e.target.value)}
                  placeholder="Hostinger VPS, Docker worker, /opt/coinbot"
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Supabase Project URL</label>
                <input
                  type="url"
                  value={projectContext.supabaseProjectUrl ?? ""}
                  onChange={(e) => updateContext("supabaseProjectUrl", e.target.value)}
                  placeholder="https://supabase.com/dashboard/project/..."
                  className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Ek Not</label>
                <textarea
                  value={projectContext.notes ?? ""}
                  onChange={(e) => updateContext("notes", e.target.value)}
                  placeholder="Branch adı, deployment ortamı, kritik kısıtlar veya AI'a iletilmesi gereken diğer bağlam bilgisi..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !projectName.trim() || !problem.trim()}
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
        ) : (
          "Analiz Başlat"
        )}
      </button>
    </form>

    {/* Wizard Modal */}
    {wizard && (() => {
      const config = WIZARD_CONFIGS[wizard.keyName];
      const canProceed = wizard.inputValue.trim().length > 0;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-500/45 bg-[#172033] p-5 shadow-2xl">
            {/* Header */}
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-base font-semibold text-slate-100">{config.title}</h3>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${wizard.step === 1 ? "bg-emerald-400" : "bg-slate-600"}`} />
                  <span className={`h-2 w-2 rounded-full ${wizard.step === 2 ? "bg-emerald-400" : "bg-slate-600"}`} />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {wizard.step === 1 ? config.label : config.step2Label}
              </p>
            </div>

            {/* Step 1: Input */}
            {wizard.step === 1 && (
              <>
                {config.multiline ? (
                  <textarea
                    autoFocus
                    value={wizard.inputValue}
                    onChange={(e) => setWizard((prev) => prev ? { ...prev, inputValue: e.target.value } : prev)}
                    placeholder={config.placeholder}
                    rows={5}
                    className="w-full resize-none rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                ) : (
                  <input
                    autoFocus
                    type={config.inputType ?? "text"}
                    value={wizard.inputValue}
                    onChange={(e) => setWizard((prev) => prev ? { ...prev, inputValue: e.target.value } : prev)}
                    onKeyDown={(e) => { if (e.key === "Enter" && canProceed) wizardNext(); }}
                    placeholder={config.placeholder}
                    className="w-full rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWizard(null)}
                    className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={wizardNext}
                    disabled={!canProceed}
                    className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    İleri →
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Preview & Confirm */}
            {wizard.step === 2 && (
              <>
                {renderWizardStep2Preview()}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={wizardBack}
                    className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                  >
                    ← Geri
                  </button>
                  <button
                    type="button"
                    onClick={wizardSave}
                    className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    Kaydet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    })()}

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
          <textarea
            readOnly
            value={promptModal.body}
            rows={6}
            className="w-full resize-none rounded-lg border border-slate-500/55 bg-[#202b40] px-3 py-2 text-sm leading-6 text-slate-100 focus:outline-none"
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => { setPromptModal(null); setPreparedInstruction(null); }}
              className="rounded-lg border border-slate-500/55 bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={copyPrompt}
              className="rounded-lg border border-emerald-300/70 bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
            >
              {copiedPrompt ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
