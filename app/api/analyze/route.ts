import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AIAnalysis, AnalysisSource, ConnectionUsageSummary, DecisionAttachment, DecisionRequest, DecisionResult, FinalVerdict, RepoContextSource } from "@/types/decision";
import { generateMockDecision } from "@/lib/mock-decision";
import { generatePromptOutput } from "@/lib/prompt-builder";
import { getSupabaseServer } from "@/lib/supabase-server";
import { buildRepoContext } from "@/lib/github/build-repo-context";

export const runtime = "nodejs";

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

function stripCodeFences(text: string): string {
  return text.replace(/^```[\w]*\n?/gm, "").replace(/^```$/gm, "").trim();
}

function cleanExtractedText(text: string): string {
  // RTF detection: strip control words if file was .txt but contains RTF markup
  if (text.trimStart().startsWith("{\\rtf")) {
    return text
      .replace(/\{\\rtf[\s\S]*?\{/g, "{")
      .replace(/\\[a-z]+\d* ?/gi, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  }
  return text;
}

function buildGithubContextBlock(meta: RepoContextSource | null, contextText: string): string {
  if (!meta) return "";
  if (meta.errorMessage) {
    return `\n\nGITHUB KOD BAĞLAMI:\nGitHub kod bağlamı alınamadı (${meta.errorMessage}). Kod analizi sınırlıdır; yalnızca yazılı problem tanımına ve eklenen referans dosyalara dayan.`;
  }
  if (!meta.selectedFiles.length || !contextText.trim()) {
    return `\n\nGITHUB KOD BAĞLAMI:\nGitHub repo bağlandı (${meta.owner}/${meta.repo} @ ${meta.branch}) ancak okunabilir alakalı dosya bulunamadı. Kod analizi sınırlıdır.`;
  }
  const fileList = meta.selectedFiles
    .map((f) => `- ${f.path} (${f.language}, ~${(f.size / 1024).toFixed(1)} KB)`)
    .join("\n");
  return `\n\nGITHUB KOD BAĞLAMI:\n- Repo: ${meta.owner}/${meta.repo}\n- Branch: ${meta.branch}\n- Seçilen dosyalar:\n${fileList}\n\nDosya içerikleri:\n${contextText}\n\nÖNEMLİ: Bu dosya içerikleri GitHub'dan okunmuştur. Kod analizi yaparken yalnızca burada görülen dosyalara dayan; görmediğin dosyalar hakkında kesin hüküm verme. Tahmin yerine "bu dosya bağlamda yok" demeyi tercih et.`;
}

function buildProjectContextBlock(req: DecisionRequest): string {
  const ctx = req.projectContext;
  const hasContext = !!ctx && (
    !!ctx.githubRepoUrl ||
    !!ctx.localProjectPath ||
    !!ctx.liveUrl ||
    !!ctx.vercelProjectUrl ||
    !!ctx.vpsHost ||
    !!ctx.supabaseProjectUrl ||
    !!ctx.supabaseProjectRef ||
    !!ctx.notes
  );

  // Repo analizi istendi ama bağlam verilmedi → AI'a açıkça uyarı.
  if (req.repoRequired && !hasContext) {
    return `\n\nPROJE BAĞLAMI:\nKod analizi açık ancak proje bağlantısı yok. AI yalnızca yazılı açıklama ve ek dosyaları analiz eder.`;
  }

  if (!hasContext) return "";

  const lines: string[] = [];
  if (ctx?.githubRepoUrl) lines.push(`- GitHub Repo: ${ctx.githubRepoUrl} (kod incelemesi için hedef repo budur)`);
  if (ctx?.localProjectPath) lines.push(`- Lokal Proje Yolu: ${ctx.localProjectPath} (kullanıcının yerel proje klasörü)`);
  if (ctx?.liveUrl) lines.push(`- Canlı URL: ${ctx.liveUrl} (canlı ortam)`);
  if (ctx?.vercelProjectUrl) lines.push(`- Vercel: ${ctx.vercelProjectUrl} (deploy ortamı)`);
  if (ctx?.vpsHost) lines.push(`- VPS / Worker: ${ctx.vpsHost} (runtime/worker bu ortamda)`);
  if (ctx?.supabaseProjectRef || ctx?.supabaseProjectUrl) {
    const status = ctx?.supabaseConnectionStatus === "connected" ? "OAuth bağlı" : "manuel URL";
    const ref = ctx?.supabaseProjectRef ? ` ref=${ctx.supabaseProjectRef}` : "";
    const name = ctx?.supabaseProjectName ? ` "${ctx.supabaseProjectName}"` : "";
    const url = ctx?.supabaseProjectUrl ? ` ${ctx.supabaseProjectUrl}` : "";
    lines.push(`- Supabase[${status}]:${name}${ref}${url} — bu fazda yalnızca proje metadata'sı bağlama eklenir; schema/veri okuma sonraki fazda yapılacak.`);
  }
  if (ctx?.notes) lines.push(`- Notlar: ${ctx.notes}`);

  return `\n\nPROJE BAĞLAMI:\n${lines.join("\n")}`;
}

function buildAttachmentContext(attachments?: DecisionAttachment[]): string {
  if (!attachments?.length) return "";
  const lines = attachments.map(a => {
    if (a.analysisStatus === "content_extracted") {
      if (a.contentText) {
        return `- ${a.name} (${a.type}, ${(a.size / 1024).toFixed(0)} KB) [content_extracted]\n  Metin İçeriği:\n${a.contentText}`;
      }
      if (a.contentSummary) {
        return `- ${a.name} (${a.type}, ${(a.size / 1024).toFixed(0)} KB) [content_extracted — görsel analizi]\n  Görsel Özeti:\n${a.contentSummary}`;
      }
    }
    if (a.type === "application/pdf") {
      return `- ${a.name} (application/pdf, ${(a.size / 1024).toFixed(0)} KB) [unsupported]\n  PDF eklendi ancak içerik analizi geçici olarak desteklenmiyor. AI bu PDF'in içeriğini görmüş gibi davranmamalıdır.`;
    }
    const status = a.analysisStatus ?? "metadata_only";
    const summary = a.contentSummary ? ` — ${a.contentSummary}` : "";
    return `- ${a.name} (${a.type}, ${(a.size / 1024).toFixed(0)} KB) [${status}]${summary}`;
  });
  return `\n\nREFERANS DOSYALAR:\nÖnemli: content_extracted durumundaki dosyaların içeriğini analizde aktif olarak kullan. metadata_only veya unsupported durumundaki dosyaların içeriğini görmüş gibi davranma; yalnızca dosyanın varlığını bağlam sinyali olarak değerlendir.\n\n${lines.join("\n\n")}`;
}

async function processAttachments(
  attachments: DecisionAttachment[],
  openaiKey: string | undefined,
  problemContext: string
): Promise<DecisionAttachment[]> {
  return Promise.all(
    attachments.map(async (att) => {
      const logMeta = { name: att.name, type: att.type, sizeKB: Math.round(att.size / 1024), hasDataUrl: !!att.dataUrl, visionStatus: att.visionStatus };

      // ── Görsel: OpenAI Vision analizi ──────────────────────────────────────
      if (att.visionStatus === "ready" && att.dataUrl && att.type.startsWith("image/")) {
        if (!openaiKey) {
          console.log("[verdict-ai] vision skip (no key)", logMeta);
          const { dataUrl: _d, ...rest } = att; void _d;
          return { ...rest, visionStatus: "error" as const, contentSummary: "OpenAI key yok; görsel analizi yapılamadı." };
        }
        console.log("[verdict-ai] vision attempt", logMeta);
        try {
          const openai = new OpenAI({ apiKey: openaiKey });
          const visionRes = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: 600,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: att.dataUrl, detail: "low" } },
                  {
                    type: "text",
                    text: `Bu görseli yazılım mühendisliği perspektifinden analiz et. Kullanıcı problemi: "${problemContext}"\n\nGörselde görülenler (UI, hata mesajı, kod, tablo, şema vb.), kullanıcı problemiyle ilgili önemli bulgular ve dikkat çeken anormallikler hakkında 200-300 kelimelik Türkçe özet yaz. Teknik ve somut ol.`,
                  },
                ],
              },
            ],
          });
          const summary = visionRes.choices[0]?.message?.content ?? "";
          if (summary) {
            console.log("[verdict-ai] vision success", { name: att.name, summaryLen: summary.length });
            const { dataUrl: _d, ...rest } = att; void _d;
            return { ...rest, contentSummary: summary, analysisStatus: "content_extracted" as const, visionStatus: "analyzed" as const };
          }
          console.warn("[verdict-ai] vision empty response", logMeta);
        } catch (err) {
          console.warn("[verdict-ai] vision error", { name: att.name, error: err instanceof Error ? err.message : "unknown" });
        }
        const { dataUrl: _d, ...rest } = att; void _d;
        return { ...rest, visionStatus: "error" as const, contentSummary: "Görsel analizi başarısız." };
      }

      // ── PDF: içerik analizi geçici olarak desteklenmiyor ───────────────────
      if (att.type === "application/pdf") {
        console.log("[verdict-ai] pdf unsupported (parse disabled)", { name: att.name, sizeKB: Math.round(att.size / 1024) });
        const { dataUrl: _d, ...rest } = att; void _d;
        return {
          ...rest,
          analysisStatus: "unsupported" as const,
          contentSummary: "PDF içerik analizi geçici olarak desteklenmiyor. PDF içeriğini analiz ettirmek için metni TXT veya Markdown olarak ekleyin.",
        };
      }

      // ── TXT/JSON/MD: RTF temizleme ─────────────────────────────────────────
      if (att.contentText) {
        const cleaned = cleanExtractedText(att.contentText);
        if (cleaned !== att.contentText) {
          console.log("[verdict-ai] rtf cleaned", { name: att.name });
        }
        const { dataUrl: _d, ...rest } = att; void _d;
        return { ...rest, contentText: cleaned };
      }

      // ── Diğer: dataUrl varsa strip et ──────────────────────────────────────
      if (att.dataUrl) {
        const { dataUrl: _d, ...rest } = att; void _d;
        return rest;
      }

      return att;
    })
  );
}

function stripDataUrls(attachments: DecisionAttachment[]): DecisionAttachment[] {
  return attachments.map(({ dataUrl: _d, ...rest }) => { void _d; return rest; });
}

// ─── Claude prompt & parser ──────────────────────────────────────────────────

function buildClaudePrompt(req: DecisionRequest, githubBlock: string): string {
  return `Sen deneyimli bir yazılım mühendisi ve teknik mimarısın. Aşağıdaki yazılım talebini analiz et ve sonucu SADECE geçerli JSON formatında ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}
- Repo Erişimi: ${req.repoRequired ? "Evet" : "Hayır"}${buildProjectContextBlock(req)}${githubBlock}

Yanıtın yalnızca aşağıdaki JSON yapısından oluşmalı; başka hiçbir metin ekleme:

{
  "title": "kısa analiz başlığı (en fazla 60 karakter)",
  "summary": "teknik özet (2-3 cümle, Türkçe)",
  "strengths": ["güçlü yön 1", "güçlü yön 2"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "objections": ["itiraz 1", "itiraz 2"],
  "recommendation": "net öneri cümlesi (Türkçe)",
  "confidenceScore": 85
}

Kurallar:
- Tüm değerler Türkçe olacak
- confidenceScore 0-100 arası tamsayı olacak
- Teknik, somut ve kısa yanıt ver
- Sadece JSON döndür${buildAttachmentContext(req.attachments)}`;
}

function parseClaudeAnalysis(text: string, fallback: AIAnalysis): AIAnalysis {
  try {
    const match = stripCodeFences(text).match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    return {
      role: "claude_engineer",
      title: typeof p.title === "string" ? p.title : fallback.title,
      summary: typeof p.summary === "string" ? p.summary : fallback.summary,
      strengths: Array.isArray(p.strengths) ? p.strengths.map(String) : fallback.strengths,
      risks: Array.isArray(p.risks) ? p.risks.map(String) : fallback.risks,
      objections: Array.isArray(p.objections) ? p.objections.map(String) : fallback.objections,
      recommendation: typeof p.recommendation === "string" ? p.recommendation : fallback.recommendation,
      confidenceScore:
        typeof p.confidenceScore === "number"
          ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
          : fallback.confidenceScore,
    };
  } catch {
    return fallback;
  }
}

// ─── OpenAI codex prompt & parser ───────────────────────────────────────────

function buildCodexPrompt(req: DecisionRequest, claude: AIAnalysis, githubBlock: string): string {
  return `Sen kıdemli bir kod denetçisi ve ikinci mühendissin. Ana görevin uygulanabilirlik, kod riski, test riski, regression riski, gereksiz refactor riski ve edge-case tespitidir. Kod yazma; yalnızca karar analizi üret.

Aşağıdaki yazılım talebini ve ana mühendis analizini incele, bağımsız bir kod denetimi yap. Sonucu SADECE geçerli JSON formatında ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}
- Repo Erişimi: ${req.repoRequired ? "Evet" : "Hayır"}${buildProjectContextBlock(req)}${githubBlock}

ANA MÜHENDİS (CLAUDE) ANALİZİ:
- Özet: ${claude.summary}
- Güçlü Yönler: ${claude.strengths.join("; ")}
- Riskler: ${claude.risks.join("; ")}
- Öneri: ${claude.recommendation}

Ana mühendis analizini birebir kopyalama; kod denetçisi perspektifinden bağımsız değerlendirme yap.

Yanıtın yalnızca aşağıdaki JSON yapısından oluşmalı; başka hiçbir metin ekleme:

{
  "title": "kısa denetim başlığı (en fazla 60 karakter)",
  "summary": "kod denetimi özeti (2-3 cümle, Türkçe)",
  "strengths": ["teknik güçlü yön 1", "teknik güçlü yön 2"],
  "risks": ["kod/test riski 1", "regression riski 2", "edge-case riski 3"],
  "objections": ["denetçi itirazı 1", "denetçi itirazı 2"],
  "recommendation": "kod denetçisi önerisi (Türkçe, net)",
  "confidenceScore": 78
}

Kurallar:
- Tüm değerler Türkçe olacak
- confidenceScore 0-100 arası tamsayı olacak
- Kod kalitesi, test ve risk odaklı yanıt ver
- Sadece JSON döndür${buildAttachmentContext(req.attachments)}`;
}

function parseCodexAnalysis(text: string, fallback: AIAnalysis): AIAnalysis {
  try {
    const match = stripCodeFences(text).match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    return {
      role: "codex_reviewer",
      title: typeof p.title === "string" ? p.title : fallback.title,
      summary: typeof p.summary === "string" ? p.summary : fallback.summary,
      strengths: Array.isArray(p.strengths) ? p.strengths.map(String) : fallback.strengths,
      risks: Array.isArray(p.risks) ? p.risks.map(String) : fallback.risks,
      objections: Array.isArray(p.objections) ? p.objections.map(String) : fallback.objections,
      recommendation: typeof p.recommendation === "string" ? p.recommendation : fallback.recommendation,
      confidenceScore:
        typeof p.confidenceScore === "number"
          ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
          : fallback.confidenceScore,
    };
  } catch {
    return fallback;
  }
}

// ─── Gemini context reviewer prompt, API & parser ────────────────────────────

function buildGeminiPrompt(
  req: DecisionRequest,
  claude: AIAnalysis,
  codex: AIAnalysis,
  githubBlock: string
): string {
  return `Sen Gemini bağlam denetçisisin. Görevin nihai karar vermek değil; talep, ek dosyalar (görsel/PDF/TXT) ve GitHub kod bağlamı arasındaki tutarlılığı denetlemek; Claude ve Codex analizlerine destek veya itiraz noktaları üretmektir. Çoklu ortam (görsel + metin + uzun bağlam) yorumlamada güçlüsün.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}
- Repo Erişimi: ${req.repoRequired ? "Evet" : "Hayır"}${buildProjectContextBlock(req)}${githubBlock}

CLAUDE MÜHENDİS ANALİZİ:
- Özet: ${claude.summary}
- Riskler: ${claude.risks.join("; ")}
- Öneri: ${claude.recommendation}

CODEX KOD DENETÇİSİ ANALİZİ:
- Özet: ${codex.summary}
- Riskler: ${codex.risks.join("; ")}
- Öneri: ${codex.recommendation}

Görevin:
- Yazılı talep ile referans dosyalar/görseller arasındaki tutarlılığı değerlendir.
- GitHub kod bağlamı varsa seçilmemiş ama riskli olabilecek alanlara dikkat çek.
- Claude ve Codex'in atlamış olabileceği bağlam noktaları varsa belirt.
- Nihai karar verme; sadece destek veya itiraz noktaları üret.

Yanıtın yalnızca aşağıdaki JSON yapısından oluşmalı; başka hiçbir metin ekleme:

{
  "title": "kısa bağlam denetimi başlığı (en fazla 60 karakter)",
  "summary": "bağlam tutarlılığı özeti (2-3 cümle, Türkçe)",
  "strengths": ["bağlamın güçlü yönü 1", "bağlamın güçlü yönü 2"],
  "risks": ["bağlam riski 1", "bağlam riski 2"],
  "objections": ["destek/itiraz noktası 1", "destek/itiraz noktası 2"],
  "recommendation": "bağlam denetçisi önerisi (Türkçe)",
  "confidenceScore": 75
}

Kurallar:
- Tüm değerler Türkçe olacak
- confidenceScore 0-100 arası tamsayı olacak
- Karar verme yetkisi senin değil; sen yalnızca bağlam denetçisisin
- Sadece JSON döndür${buildAttachmentContext(req.attachments)}`;
}

async function callGeminiAnalysis(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      const trimmed = body.trim().slice(0, 240);
      if (trimmed) detail = ` — ${trimmed}`;
    } catch {}
    throw new Error(`Gemini API ${res.status} (model=${GEMINI_MODEL})${detail}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text;
}

function parseGeminiAnalysis(text: string, fallback: AIAnalysis): AIAnalysis {
  try {
    const match = stripCodeFences(text).match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    return {
      role: "gemini_context_reviewer",
      title: typeof p.title === "string" ? p.title : fallback.title,
      summary: typeof p.summary === "string" ? p.summary : fallback.summary,
      strengths: Array.isArray(p.strengths) ? p.strengths.map(String) : fallback.strengths,
      risks: Array.isArray(p.risks) ? p.risks.map(String) : fallback.risks,
      objections: Array.isArray(p.objections) ? p.objections.map(String) : fallback.objections,
      recommendation: typeof p.recommendation === "string" ? p.recommendation : fallback.recommendation,
      confidenceScore:
        typeof p.confidenceScore === "number"
          ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
          : fallback.confidenceScore,
    };
  } catch {
    return fallback;
  }
}

// ─── OpenAI judge prompt & parser ────────────────────────────────────────────

function buildJudgePrompt(
  req: DecisionRequest,
  claude: AIAnalysis,
  codex: AIAnalysis,
  gemini: AIAnalysis,
  githubBlock: string
): string {
  return `Sen yazılım mühendisliği kararlarında hakem rolünde deneyimli bir teknik direktörüsün. Aşağıdaki talep ve üç bağımsız AI analizini değerlendirip SADECE geçerli JSON formatında final karar ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}${buildProjectContextBlock(req)}${githubBlock}

CLAUDE MÜHENDİS ANALİZİ:
- Özet: ${claude.summary}
- Güçlü Yönler: ${claude.strengths.join("; ")}
- Riskler: ${claude.risks.join("; ")}
- Öneri: ${claude.recommendation}
- Güven Skoru: %${claude.confidenceScore}

CODEX KOD DENETÇİSİ ANALİZİ:
- Özet: ${codex.summary}
- Riskler: ${codex.risks.join("; ")}
- Öneri: ${codex.recommendation}
- Güven Skoru: %${codex.confidenceScore}

GEMINI BAĞLAM DENETİMİ (destekleyici görüş):
- Özet: ${gemini.summary}
- Bağlam Riskleri: ${gemini.risks.join("; ")}
- İtiraz/Destek: ${gemini.objections.join("; ")}
- Öneri: ${gemini.recommendation}
- Güven Skoru: %${gemini.confidenceScore}

NOT: Gemini bağlam denetimi destekleyici görüştür; nihai hakem senin kararındır. Gemini'nin bağlam uyarılarını dikkate al ama nihai kararı Claude ve Codex sentezi üzerinden kur.

Bu üç analizi sentezleyerek bağımsız bir hakem kararı ver. Analizleri birebir kopyalama, kendi değerlendirmeni ekle.

Yanıtın yalnızca aşağıdaki JSON yapısından oluşmalı; başka hiçbir metin ekleme:

{
  "verdict": "nihai karar cümlesi (Türkçe, net ve kesin)",
  "executionPlan": "adım adım uygulama planı (Türkçe, → ile ayrılmış adımlar)",
  "rejectedSuggestions": ["reddedilen öneri 1", "reddedilen öneri 2"],
  "risks": ["kritik risk 1", "kritik risk 2"],
  "nextAction": "hemen yapılması gereken ilk adım (Türkçe)",
  "confidenceScore": 90
}

Kurallar:
- Tüm değerler Türkçe olacak
- confidenceScore 0-100 arası tamsayı olacak
- Hakem olarak bağımsız ve net karar ver
- Sadece JSON döndür${buildAttachmentContext(req.attachments)}`;
}

function parseJudgeVerdict(text: string, fallback: FinalVerdict): FinalVerdict {
  try {
    const match = stripCodeFences(text).match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);

    const executionPlan: string[] = Array.isArray(p.executionPlan)
      ? p.executionPlan.map(String)
      : typeof p.executionPlan === "string" && p.executionPlan.trim()
        ? [p.executionPlan]
        : fallback.executionPlan;

    return {
      verdict: typeof p.verdict === "string" ? p.verdict : fallback.verdict,
      executionPlan,
      rejectedSuggestions: Array.isArray(p.rejectedSuggestions)
        ? p.rejectedSuggestions.map(String)
        : fallback.rejectedSuggestions,
      risks: Array.isArray(p.risks) ? p.risks.map(String) : fallback.risks,
      nextAction: typeof p.nextAction === "string" ? p.nextAction : fallback.nextAction,
      confidenceScore:
        typeof p.confidenceScore === "number"
          ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
          : fallback.confidenceScore,
    };
  } catch {
    return fallback;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let request: DecisionRequest;
  try {
    request = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const rawAttachments = request.attachments ?? [];
  const hasImages = rawAttachments.some(a => a.visionStatus === "ready");
  const hasPdfs = rawAttachments.some(a => a.type === "application/pdf" && a.dataUrl);
  console.log("[verdict-ai] analyze", {
    hasAnthropicKey: !!anthropicKey,
    hasOpenAIKey: !!openaiKey,
    hasGeminiKey: !!geminiKey,
    openaiModel: OPENAI_MODEL,
    claudeModel: CLAUDE_MODEL,
    geminiModel: GEMINI_MODEL,
    attachments: rawAttachments.length,
    hasImages,
    hasPdfs,
  });

  // Pre-step: Görsel vision analizi + PDF metin çıkarma
  const processedAttachments = rawAttachments.length
    ? await processAttachments(rawAttachments, openaiKey, request.problem)
    : [];
  // request içindeki attachments'ı işlenmiş (dataUrl olmayan) versiyonla güncelle
  const enrichedRequest: DecisionRequest = { ...request, attachments: processedAttachments };

  // Pre-step: GitHub repo context (FAZ 2A) — repoRequired=true ve GitHub URL varsa.
  let repoContext: RepoContextSource | null = null;
  let githubBlock = "";
  if (enrichedRequest.repoRequired && !enrichedRequest.projectContext?.githubRepoUrl?.trim()) {
    repoContext = {
      source: "github",
      owner: "",
      repo: "",
      branch: "",
      selectedFiles: [],
      warnings: [],
      fetchedAt: new Date().toISOString(),
      errorMessage: "GitHub repo bağlantısı eklenmedi. Kod analizi yalnızca yazılı açıklama ve ek dosyalara dayandırılmıştır.",
    };
  }
  if (enrichedRequest.repoRequired && enrichedRequest.projectContext?.githubRepoUrl?.trim()) {
    try {
      const built = await buildRepoContext({
        githubRepoUrl: enrichedRequest.projectContext.githubRepoUrl,
        problem: enrichedRequest.problem,
        requestType: enrichedRequest.requestType,
        projectName: enrichedRequest.projectName,
      });
      repoContext = built.meta;
      githubBlock = buildGithubContextBlock(built.meta, built.contextText);
      console.log("[verdict-ai] github context", {
        owner: built.meta.owner,
        repo: built.meta.repo,
        branch: built.meta.branch,
        files: built.meta.selectedFiles.length,
        chars: built.contextText.length,
        warnings: built.meta.warnings.length,
        error: built.meta.errorMessage ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bilinmeyen hata";
      console.warn("[verdict-ai] github context error:", msg);
      repoContext = {
        source: "github",
        owner: "",
        repo: "",
        branch: "",
        selectedFiles: [],
        warnings: [],
        fetchedAt: new Date().toISOString(),
        errorMessage: "GitHub kod bağlamı alınamadı.",
      };
      githubBlock = buildGithubContextBlock(repoContext, "");
    }
  }

  const mockResult = generateMockDecision(enrichedRequest);
  const mockClaudeAnalysis = mockResult.analyses.find((a) => a.role === "claude_engineer")!;
  const mockCodexAnalysis = mockResult.analyses.find((a) => a.role === "codex_reviewer")!;
  const mockGeminiAnalysis = mockResult.analyses.find((a) => a.role === "gemini_context_reviewer")!;

  // Step 1: Claude mühendis analizi
  let claudeAnalysis = mockClaudeAnalysis;
  let claudeSource: AnalysisSource = "mock";

  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildClaudePrompt(enrichedRequest, githubBlock) }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      claudeAnalysis = parseClaudeAnalysis(text, mockClaudeAnalysis);
      claudeSource = "live";
    } catch (err) {
      console.warn("[verdict-ai] Claude error:", err instanceof Error ? err.message : "unknown");
    }
  }

  // Step 2: Codex kod denetçisi analizi (OpenAI, Claude bağlamıyla)
  let codexAnalysis = mockCodexAnalysis;
  let codexSource: AnalysisSource = "mock";

  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const codexCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildCodexPrompt(enrichedRequest, claudeAnalysis, githubBlock) }],
      });
      const codexText = codexCompletion.choices[0]?.message?.content ?? "";
      codexAnalysis = parseCodexAnalysis(codexText, mockCodexAnalysis);
      codexSource = "live";
    } catch (err) {
      console.warn("[verdict-ai] Codex error:", err instanceof Error ? err.message : "unknown");
    }
  }

  // Step 3: Gemini bağlam denetimi (destekleyici, ana flow'u durdurmaz)
  let geminiAnalysis = mockGeminiAnalysis;
  let geminiSource: AnalysisSource = "mock";
  let geminiError: string | undefined;

  if (!geminiKey) {
    geminiError = "GEMINI_API_KEY tanımlı değil; Gemini bağlam denetimi devre dışı.";
  } else {
    try {
      const geminiText = await callGeminiAnalysis(
        buildGeminiPrompt(enrichedRequest, claudeAnalysis, codexAnalysis, githubBlock),
        geminiKey
      );
      const parsed = parseGeminiAnalysis(geminiText, mockGeminiAnalysis);
      // Live yalnızca parse başarılıysa: parser fallback ise summary mock ile aynı kalır
      const parseSucceeded = stripCodeFences(geminiText).match(/\{[\s\S]*\}/) !== null && parsed.summary !== mockGeminiAnalysis.summary;
      geminiAnalysis = parsed;
      geminiSource = parseSucceeded ? "live" : "mock";
      if (!parseSucceeded) {
        geminiError = `Gemini yanıtı JSON olarak parse edilemedi (model=${GEMINI_MODEL}).`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bilinmeyen hata";
      geminiError = msg;
      console.warn("[verdict-ai] Gemini error:", msg);
    }
  }

  // Step 4: ChatGPT hakem final verdict (Claude + Codex + Gemini analizlerini bağlam olarak alır)
  let finalVerdict = mockResult.finalVerdict;
  let judgeSource: AnalysisSource = "mock";

  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const judgeCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildJudgePrompt(enrichedRequest, claudeAnalysis, codexAnalysis, geminiAnalysis, githubBlock) }],
      });
      const judgeText = judgeCompletion.choices[0]?.message?.content ?? "";
      finalVerdict = parseJudgeVerdict(judgeText, mockResult.finalVerdict);
      judgeSource = "live";
    } catch (err) {
      console.warn("[verdict-ai] Judge error:", err instanceof Error ? err.message : "unknown");
    }
  }

  const promptOutput = generatePromptOutput(
    enrichedRequest,
    claudeAnalysis,
    codexAnalysis,
    finalVerdict,
    processedAttachments,
    repoContext,
    geminiAnalysis
  );

  const ctx = enrichedRequest.projectContext;
  const connectionUsageSummary: ConnectionUsageSummary = {
    repoRequired: !!enrichedRequest.repoRequired,
    hasGithubRepoUrl: !!ctx?.githubRepoUrl?.trim(),
    githubContextFetched: !!repoContext && !repoContext.errorMessage && repoContext.selectedFiles.length > 0,
    githubContextFileCount: repoContext?.selectedFiles.length ?? 0,
    ...(repoContext?.errorMessage ? { githubContextError: repoContext.errorMessage } : {}),
    hasGeminiKey: !!geminiKey,
    geminiSource,
    ...(geminiError ? { geminiError } : {}),
    hasSupabaseContext: !!(ctx?.supabaseProjectUrl?.trim() || ctx?.supabaseProjectRef?.trim()),
    hasLocalPath: !!ctx?.localProjectPath?.trim(),
    hasLiveUrl: !!ctx?.liveUrl?.trim(),
    hasVercelUrl: !!ctx?.vercelProjectUrl?.trim(),
    hasVpsHost: !!ctx?.vpsHost?.trim(),
  };

  const finalResult: DecisionResult = {
    ...mockResult,
    analyses: mockResult.analyses.map((a) => {
      if (a.role === "claude_engineer") return claudeAnalysis;
      if (a.role === "codex_reviewer") return codexAnalysis;
      if (a.role === "gemini_context_reviewer") return geminiAnalysis;
      return a;
    }),
    finalVerdict,
    promptOutput,
    claudeSource,
    codexSource,
    judgeSource,
    geminiSource,
    ...(geminiError ? { geminiError } : {}),
    ...(repoContext ? { repoContext } : {}),
    connectionUsageSummary,
  };

  // Step 4: Supabase kayıt (env yoksa veya hata olursa sessizce atla)
  let saved = false;
  let recordId: string | undefined;
  const supabase = getSupabaseServer();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("decision_records")
        .insert({
          project_name: enrichedRequest.projectName,
          request_type: enrichedRequest.requestType,
          priority: enrichedRequest.priority,
          problem: enrichedRequest.problem,
          expected_output: enrichedRequest.expectedOutput,
          repo_required: enrichedRequest.repoRequired,
          status: enrichedRequest.status,
          claude_source: claudeSource,
          codex_source: codexSource,
          judge_source: judgeSource,
          request_json: enrichedRequest,
          result_json: finalResult,
          attachments_json: stripDataUrls(processedAttachments),
        })
        .select("id")
        .single();
      if (error) {
        console.warn("[verdict-ai] Supabase kayıt hatası:", error.message);
      } else {
        saved = true;
        recordId = (data as { id: string }).id;
      }
    } catch (err) {
      console.warn("[verdict-ai] Supabase erişim hatası:", err instanceof Error ? err.message : "bilinmeyen hata");
    }
  }

  return NextResponse.json({ ...finalResult, saved, recordId, enrichedAttachments: processedAttachments });
}
