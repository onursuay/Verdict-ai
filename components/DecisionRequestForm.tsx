"use client";

import { useState, useRef } from "react";
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

export default function DecisionRequestForm({ onSubmit, isLoading }: DecisionRequestFormProps) {
  const [projectName, setProjectName] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("Yeni Özellik");
  const [priority, setPriority] = useState<Priority>("Orta");
  const [problem, setProblem] = useState("");
  const [repoRequired, setRepoRequired] = useState(false);
  const [attachments, setAttachments] = useState<DecisionAttachment[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateContext = (key: keyof ProjectContext, value: string) => {
    setProjectContext((prev) => ({ ...prev, [key]: value }));
  };

  const sanitizedContext = (): ProjectContext | undefined => {
    const trimmed: ProjectContext = {};
    (Object.keys(projectContext) as Array<keyof ProjectContext>).forEach((k) => {
      const v = projectContext[k]?.trim();
      if (v) trimmed[k] = v;
    });
    return Object.keys(trimmed).length ? trimmed : undefined;
  };

  const hasAnyContext =
    !!projectContext.githubRepoUrl?.trim() ||
    !!projectContext.localProjectPath?.trim() ||
    !!projectContext.liveUrl?.trim() ||
    !!projectContext.vercelProjectUrl?.trim() ||
    !!projectContext.vpsHost?.trim() ||
    !!projectContext.supabaseProjectUrl?.trim() ||
    !!projectContext.notes?.trim();

  const ALLOWED_TYPES = ["image/png","image/jpeg","image/webp","application/pdf","text/plain","application/json","text/markdown"];
  const TEXT_TYPES = ["text/plain", "application/json", "text/markdown"];
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
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
        // PDF parse geçici olarak devre dışı; sadece metadata kaydediyoruz
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

  return (
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
          placeholder="örn: CoinBot, YoAi, Antso, Yeni Proje"
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

      {/* Problem / Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Problem / Prompt
        </label>
        <textarea
          value={problem}
          onChange={(e) => {
            setProblem(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          placeholder="Konuyu, hatayı, hedefi veya analiz edilmesini istediğin durumu detaylı yaz…"
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

        {/* Drop Zone */}
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

        {/* File List */}
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

      {/* Proje Bağlamı — sadece repoRequired açıkken */}
      {repoRequired && (
        <div className="space-y-3 p-4 bg-slate-700/30 rounded-lg border border-slate-500/45">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Proje Bağlamı</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Doldurulan alanlar AI promptlarına dahil edilir. Hepsi opsiyoneldir.
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-200 bg-emerald-400/10 border border-emerald-300/25 px-2 py-0.5 rounded-full">
              Repo bağlamı
            </span>
          </div>

          {!hasAnyContext && (
            <div className="text-xs text-amber-200 bg-amber-400/10 border border-amber-300/25 rounded-lg px-3 py-2">
              Kod deposu analizi istendi ancak GitHub repo veya proje yolu belirtilmedi.
              AI bu durumda yalnızca yazılı açıklama ve ek dosyaları analiz eder.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">GitHub Repo URL</label>
              <input
                type="url"
                value={projectContext.githubRepoUrl ?? ""}
                onChange={(e) => updateContext("githubRepoUrl", e.target.value)}
                placeholder="https://github.com/onursuay/coinbot"
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
              {projectContext.githubRepoUrl?.trim() && (
                <p className="mt-1 text-xs text-emerald-200/85">
                  GitHub repo verildi. Analiz sırasında ilgili dosyalar okunmaya çalışılacak.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Lokal Proje Yolu</label>
              <input
                type="text"
                value={projectContext.localProjectPath ?? ""}
                onChange={(e) => updateContext("localProjectPath", e.target.value)}
                placeholder="/Users/onursuay/Desktop/Onur Suay/Web Siteleri/coinbot"
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Canlı Site URL</label>
              <input
                type="url"
                value={projectContext.liveUrl ?? ""}
                onChange={(e) => updateContext("liveUrl", e.target.value)}
                placeholder="https://coin.onursuay.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Vercel Project URL</label>
              <input
                type="url"
                value={projectContext.vercelProjectUrl ?? ""}
                onChange={(e) => updateContext("vercelProjectUrl", e.target.value)}
                placeholder="https://vercel.com/onur-suay/coinbot"
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">VPS / Worker Bilgisi</label>
              <input
                type="text"
                value={projectContext.vpsHost ?? ""}
                onChange={(e) => updateContext("vpsHost", e.target.value)}
                placeholder="Hostinger VPS, Docker worker, /opt/coinbot"
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Supabase Project URL</label>
              <input
                type="url"
                value={projectContext.supabaseProjectUrl ?? ""}
                onChange={(e) => updateContext("supabaseProjectUrl", e.target.value)}
                placeholder="https://supabase.com/dashboard/project/..."
                className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Ek Not</label>
            <textarea
              value={projectContext.notes ?? ""}
              onChange={(e) => updateContext("notes", e.target.value)}
              placeholder="Branch adı, deployment ortamı, kritik kısıtlar veya AI'a iletilmesi gereken diğer bağlam bilgisi…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-500/55 bg-[#202b40] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60 transition resize-none"
            />
          </div>
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
  );
}
