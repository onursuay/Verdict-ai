import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AIAnalysis, AnalysisSource, DecisionRequest, FinalVerdict } from "@/types/decision";
import { generateMockDecision } from "@/lib/mock-decision";

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.1";

// ─── Claude prompt & parser ──────────────────────────────────────────────────

function buildClaudePrompt(req: DecisionRequest): string {
  return `Sen deneyimli bir yazılım mühendisi ve teknik mimarısın. Aşağıdaki yazılım talebini analiz et ve sonucu SADECE geçerli JSON formatında ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}
- Repo Erişimi: ${req.repoRequired ? "Evet" : "Hayır"}

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
- Sadece JSON döndür`;
}

function parseClaudeAnalysis(text: string, fallback: AIAnalysis): AIAnalysis {
  try {
    const match = text.match(/\{[\s\S]*\}/);
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

function buildCodexPrompt(req: DecisionRequest, claude: AIAnalysis): string {
  return `Sen kıdemli bir kod denetçisi ve ikinci mühendissin. Ana görevin uygulanabilirlik, kod riski, test riski, regression riski, gereksiz refactor riski ve edge-case tespitidir. Kod yazma; yalnızca karar analizi üret.

Aşağıdaki yazılım talebini ve ana mühendis analizini incele, bağımsız bir kod denetimi yap. Sonucu SADECE geçerli JSON formatında ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}
- Repo Erişimi: ${req.repoRequired ? "Evet" : "Hayır"}

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
- Sadece JSON döndür`;
}

function parseCodexAnalysis(text: string, fallback: AIAnalysis): AIAnalysis {
  try {
    const match = text.match(/\{[\s\S]*\}/);
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

// ─── OpenAI judge prompt & parser ────────────────────────────────────────────

function buildJudgePrompt(
  req: DecisionRequest,
  claude: AIAnalysis,
  codex: AIAnalysis
): string {
  return `Sen yazılım mühendisliği kararlarında hakem rolünde deneyimli bir teknik direktörüsün. Aşağıdaki talep ve iki bağımsız AI analizini değerlendirip SADECE geçerli JSON formatında final karar ver.

TALEP:
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}

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

Bu iki analizi sentezleyerek bağımsız bir hakem kararı ver. Analizleri birebir kopyalama, kendi değerlendirmeni ekle.

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
- Sadece JSON döndür`;
}

function parseJudgeVerdict(text: string, fallback: FinalVerdict): FinalVerdict {
  try {
    const match = text.match(/\{[\s\S]*\}/);
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

  const mockResult = generateMockDecision(request);
  const mockClaudeAnalysis = mockResult.analyses.find((a) => a.role === "claude_engineer")!;
  const mockCodexAnalysis = mockResult.analyses.find((a) => a.role === "codex_reviewer")!;

  // Step 1: Claude mühendis analizi
  let claudeAnalysis = mockClaudeAnalysis;
  let claudeSource: AnalysisSource = "mock";

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildClaudePrompt(request) }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      claudeAnalysis = parseClaudeAnalysis(text, mockClaudeAnalysis);
      claudeSource = "live";
    } catch {
      // mock kalır
    }
  }

  // Step 2: Codex kod denetçisi analizi (OpenAI, Claude bağlamıyla)
  let codexAnalysis = mockCodexAnalysis;
  let codexSource: AnalysisSource = "mock";

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const codexCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildCodexPrompt(request, claudeAnalysis) }],
      });
      const codexText = codexCompletion.choices[0]?.message?.content ?? "";
      codexAnalysis = parseCodexAnalysis(codexText, mockCodexAnalysis);
      codexSource = "live";
    } catch {
      // mock kalır
    }
  }

  // Step 3: ChatGPT hakem final verdict (Claude + Codex analizlerini bağlam olarak alır)
  let finalVerdict = mockResult.finalVerdict;
  let judgeSource: AnalysisSource = "mock";

  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const judgeCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildJudgePrompt(request, claudeAnalysis, codexAnalysis) }],
      });
      const judgeText = judgeCompletion.choices[0]?.message?.content ?? "";
      finalVerdict = parseJudgeVerdict(judgeText, mockResult.finalVerdict);
      judgeSource = "live";
    } catch {
      // mock kalır
    }
  }

  return NextResponse.json({
    ...mockResult,
    analyses: mockResult.analyses.map((a) => {
      if (a.role === "claude_engineer") return claudeAnalysis;
      if (a.role === "codex_reviewer") return codexAnalysis;
      return a;
    }),
    finalVerdict,
    claudeSource,
    codexSource,
    judgeSource,
  });
}
