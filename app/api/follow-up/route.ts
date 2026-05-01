import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { DecisionFollowUp, DecisionRequest, DecisionResult } from "@/types/decision";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

export async function POST(req: NextRequest) {
  let body: {
    decisionRecordId?: string;
    request?: DecisionRequest;
    result?: DecisionResult;
    question?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { decisionRecordId, request, result, question } = body;
  if (!request || !result || !question?.trim()) {
    return NextResponse.json({ error: "request, result ve question zorunlu" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const claude = result.analyses.find(a => a.role === "claude_engineer");
  const codex = result.analyses.find(a => a.role === "codex_reviewer");

  const contextPrompt = `MEVCUT KARAR ANALİZİ ÖZETI:
Proje: ${request.projectName}
Talep Tipi: ${request.requestType}
Öncelik: ${request.priority}
Problem: ${request.problem}

Nihai Karar: ${result.finalVerdict.verdict}
${claude ? `Claude Mühendis: ${claude.summary}\nÖneri: ${claude.recommendation}` : ""}
${codex ? `Codex Denetçi: ${codex.summary}\nÖneri: ${codex.recommendation}` : ""}
Uygulama Planı: ${result.finalVerdict.executionPlan.join(" → ")}
Sonraki Adım: ${result.finalVerdict.nextAction}

KULLANICININ EK SORUSU:
${question}`;

  let answer = "";

  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: "Sen teknik bir danışman ve karar hakemisin. Kullanıcı daha önce bir yazılım kararı analizi yaptırdı ve şimdi takip sorusu soruyor. Kısa, net ve uygulanabilir Türkçe yanıt ver. 150-400 kelime. Teknik ve karar odaklı ol.",
          },
          { role: "user", content: contextPrompt },
        ],
      });
      answer = completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      console.warn("[verdict-ai] follow-up OpenAI error:", err instanceof Error ? err.message : "unknown");
    }
  }

  if (!answer) {
    answer = `AI servisi şu an kullanılamıyor. Sorunuz: "${question.slice(0, 100)}" — Mevcut analizin uygulama planını ve risk bölümünü referans alarak ilerleyin.`;
  }

  const followUp: DecisionFollowUp = {
    id: crypto.randomUUID(),
    question: question.trim(),
    answer,
    createdAt: new Date(),
  };

  // Save follow-up to Supabase result_json if decisionRecordId provided
  if (decisionRecordId) {
    const supabase = getSupabaseServer();
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from("decision_records")
          .select("result_json")
          .eq("id", decisionRecordId)
          .single();

        if (existing?.result_json) {
          const currentFollowUps: unknown[] = existing.result_json.followUps ?? [];
          const updatedFollowUps = [
            ...currentFollowUps,
            { ...followUp, createdAt: followUp.createdAt.toISOString() },
          ];
          await supabase
            .from("decision_records")
            .update({
              result_json: { ...existing.result_json, followUps: updatedFollowUps },
            })
            .eq("id", decisionRecordId);
        }
      } catch (err) {
        console.warn("[verdict-ai] follow-up supabase save error:", err instanceof Error ? err.message : "unknown");
      }
    }
  }

  return NextResponse.json({ followUp: { ...followUp, createdAt: followUp.createdAt.toISOString() } });
}
