import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AIAnalysis, DecisionRequest } from "@/types/decision";
import { generateMockDecision } from "@/lib/mock-decision";

const CLAUDE_MODEL = "claude-sonnet-4-6";

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

    const parsed = JSON.parse(match[0]);

    return {
      role: "claude_engineer",
      title: typeof parsed.title === "string" ? parsed.title : fallback.title,
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : fallback.strengths,
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : fallback.risks,
      objections: Array.isArray(parsed.objections) ? parsed.objections.map(String) : fallback.objections,
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : fallback.recommendation,
      confidenceScore:
        typeof parsed.confidenceScore === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.confidenceScore)))
          : fallback.confidenceScore,
    };
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  let request: DecisionRequest;

  try {
    request = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const mockResult = generateMockDecision(request);
  const mockClaudeAnalysis = mockResult.analyses.find((a) => a.role === "claude_engineer")!;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...mockResult, claudeSource: "mock" });
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildClaudePrompt(request) }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const claudeAnalysis = parseClaudeAnalysis(text, mockClaudeAnalysis);

    return NextResponse.json({
      ...mockResult,
      analyses: mockResult.analyses.map((a) =>
        a.role === "claude_engineer" ? claudeAnalysis : a
      ),
      claudeSource: "live",
    });
  } catch {
    return NextResponse.json({ ...mockResult, claudeSource: "mock" });
  }
}
