"use client";

import { useState, useRef } from "react";
import { DecisionAttachment, DecisionRequest, ExpectedOutput, Priority, RequestType } from "@/types/decision";

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
  Düşük: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
  Orta: "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100",
  Kritik: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
};

const PRIORITY_SELECTED: Record<Priority, string> = {
  Düşük: "bg-green-500 border-green-500 text-white",
  Orta: "bg-yellow-500 border-yellow-500 text-white",
  Kritik: "bg-red-500 border-red-500 text-white",
};

export default function DecisionRequestForm({ onSubmit, isLoading }: DecisionRequestFormProps) {
  const [projectName, setProjectName] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("Yeni Özellik");
  const [priority, setPriority] = useState<Priority>("Orta");
  const [problem, setProblem] = useState("");
  const [repoRequired, setRepoRequired] = useState(false);
  const [attachments, setAttachments] = useState<DecisionAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        addIfRoom({
          ...base,
          analysisStatus: "metadata_only",
          contentSummary: "Görsel dosya eklendi; bu fazda görsel içeriği okunmadı.",
        });
      } else if (f.type === "application/pdf") {
        addIfRoom({
          ...base,
          analysisStatus: "metadata_only",
          contentSummary: "PDF dosyası eklendi; bu fazda PDF içeriği okunmadı.",
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
    };

    onSubmit(request);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proje Adı */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Proje Adı
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="örn: CoinBot, YoAi, Antso, Yeni Proje"
          required
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      {/* Talep Tipi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Öncelik */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
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
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none overflow-hidden"
        />
      </div>

      {/* Referans Dosyalar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Referans Dosyalar
          <span className="ml-2 text-xs font-normal text-gray-400">İsteğe bağlı · En fazla 5 dosya · Dosya başı 10 MB</span>
        </label>
        <p className="text-xs text-gray-400 mb-3">
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
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition"
        >
          <p className="text-sm text-gray-500">Dosyaları buraya sürükleyin veya <span className="text-indigo-600 font-medium">seçmek için tıklayın</span></p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, PDF, TXT, JSON, MD</p>
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
              <li key={att.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="text-gray-400 flex-shrink-0">📎</span>
                <span className="truncate text-gray-700 font-medium flex-1">{att.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{att.type.split("/")[1]?.toUpperCase()}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{(att.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                  className="text-gray-400 hover:text-red-500 transition flex-shrink-0 cursor-pointer"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Beklenen Çıktı — otomatik */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Beklenen Çıktı
        </label>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-500 select-none">
          <span className="text-gray-400 text-xs">Otomatik:</span>
          <span className="font-medium text-gray-700">{OUTPUT_BY_TYPE[requestType]}</span>
          <span className="ml-auto text-xs text-gray-400">Talep tipine göre belirlenir</span>
        </div>
      </div>

      {/* Repo Gerekli */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <button
          type="button"
          onClick={() => setRepoRequired(!repoRequired)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            repoRequired ? "bg-indigo-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              repoRequired ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
          Kod deposu analizi gerekli
          <span className="text-gray-400 text-xs font-normal">
            AI karar verirken GitHub repo/kod bağlamı gerekiyorsa açın.
          </span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
            Hazırlık
          </span>
        </span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !projectName.trim() || !problem.trim()}
        className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-semibold rounded-xl transition-all text-sm tracking-wide cursor-pointer"
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
