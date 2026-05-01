import { AIAnalysis, DecisionRequest, DecisionResult, FinalVerdict } from "@/types/decision";
import { generatePromptOutput } from "@/lib/prompt-builder";

const RISKS_BY_TYPE: Record<string, string[]> = {
  Hata: [
    "Mevcut kullanıcı verisi etkilenebilir",
    "Rollback planı hazırlanmalı",
    "Test coverage artırılmalı",
  ],
  "Yeni Özellik": [
    "Performans regresyonu riski",
    "Mevcut API kontratı bozulabilir",
    "Edge case'ler yeterince test edilmeli",
  ],
  "Mimari Karar": [
    "Uzun vadeli teknik borç oluşabilir",
    "Ekip adaptasyon süreci gerekli",
    "Mevcut sistemle entegrasyon karmaşıklaşabilir",
  ],
  "UI/UX Kararı": [
    "Kullanıcı deneyimi tutarsızlığı",
    "Accessibility standartları kontrol edilmeli",
    "Mobile uyumluluk doğrulanmalı",
  ],
  "API Entegrasyonu": [
    "3. parti servis kesintisi senaryosu planlanmalı",
    "Rate limiting politikası belirlenmeli",
    "Authentication token yönetimi güvenli olmalı",
  ],
  Güvenlik: [
    "Mevcut açıkların tam kapsamı bilinmiyor",
    "Penetrasyon testi gerekli",
    "Güvenlik yaması deployment süreci kritik",
  ],
  Diğer: [
    "Kapsam belirsizliği",
    "Kaynak gereksinimi net değil",
    "Öncelik çakışması olabilir",
  ],
};

const FEASIBILITY_BY_TYPE: Record<string, string> = {
  Hata: "Yüksek — standart hata düzeltme süreci takip edilebilir.",
  "Yeni Özellik": "Orta — gereksinim analizi tamamlandıktan sonra sprint planlaması yapılabilir.",
  "Mimari Karar": "Orta-Düşük — kapsamlı teknik değerlendirme ve paydaş onayı gerekli.",
  "UI/UX Kararı": "Yüksek — prototip üretilip A/B test ile doğrulanabilir.",
  "API Entegrasyonu": "Orta — sandbox ortamında doğrulama sonrası uygulanabilir.",
  Güvenlik: "Kritik — derhal ele alınmalı, diğer geliştirmeler askıya alınabilir.",
  Diğer: "Belirsiz — önce gereksinim netleştirilmeli.",
};

function confidenceByPriority(base: number, priority: string): number {
  if (priority === "Kritik") return Math.min(base + 8, 99);
  if (priority === "Düşük") return Math.max(base - 6, 55);
  return base;
}

export function generateMockDecision(request: DecisionRequest): DecisionResult {
  const risks = RISKS_BY_TYPE[request.requestType] ?? RISKS_BY_TYPE["Diğer"];
  const feasibility = FEASIBILITY_BY_TYPE[request.requestType] ?? FEASIBILITY_BY_TYPE["Diğer"];
  const priorityPrefix =
    request.priority === "Kritik" ? "ACİL: " : request.priority === "Orta" ? "ÖNEMLİ: " : "";

  const claudeAnalysis: AIAnalysis = {
    role: "claude_engineer",
    title: "Teknik Uygulanabilirlik Analizi",
    summary: `${priorityPrefix}"${request.projectName}" projesi için ${request.requestType.toLowerCase()} talebi incelenmiştir. ${request.problem.slice(0, 120)}... Teknik açıdan bu talep, mevcut sistem mimarisiyle uyumlu biçimde hayata geçirilebilir.`,
    strengths: [
      "Mevcut mimariyle uyumlu bir yaklaşım mümkün",
      "Standart geliştirme pratikleriyle çözüme kavuşabilir",
      `${feasibility}`,
    ],
    risks,
    objections: [
      "Gereksinim dokümanı tamamlanmadan implementasyona geçilmemeli",
      "Yan etkilerin tam olarak haritalanması gerekiyor",
    ],
    recommendation: feasibility,
    confidenceScore: confidenceByPriority(82, request.priority),
  };

  const codexAnalysis: AIAnalysis = {
    role: "codex_reviewer",
    title: "Kod & Test Risk Denetimi",
    summary: `"${request.projectName}" projesindeki ${request.requestType.toLowerCase()} değişikliği kod tabanı üzerinde ${request.priority === "Kritik" ? "yüksek" : "orta düzey"} etki yaratabilir. Bağımlı modüller taranmalı.`,
    strengths: [
      "Feature flag ile kademeli rollout mümkün",
      "Mevcut test altyapısı temel senaryoları karşılıyor",
    ],
    risks: [
      request.priority === "Kritik"
        ? "YÜKSEKİ — Kod tabanında breaking change ihtimali var. Kapsamlı regression testi şart."
        : "ORTA — Değişiklik lokalize görünüyor, ancak bağımlı modüller kontrol edilmeli.",
      "Birim testlerinin mevcut coverage'ı yeterli olmayabilir. Entegrasyon testleri eklenmeli.",
    ],
    objections: [
      "Test suite genişletilmeden merge yapılmamalı",
      "Staging ortamında tam doğrulama şart",
    ],
    recommendation: `Feature flag kullanarak kademeli rollout yapılması önerilebilir. Bu sayede ${request.projectName} projesi etkilenmeden A/B test yapılabilir.`,
    confidenceScore: confidenceByPriority(76, request.priority),
  };

  const chatgptAnalysis: AIAnalysis = {
    role: "chatgpt_judge",
    title: "Hakem Ön Değerlendirmesi",
    summary: `Claude ve Codex analizleri değerlendirildi. Her iki görüş de teknik açıdan tutarlı. ${request.priority === "Kritik" ? "Kritik öncelik nedeniyle hızlı aksiyon gerekli." : "Standart geliştirme süreci yeterli."} Nihai karar olarak onay verilmektedir.`,
    strengths: [
      "İki bağımsız AI analizi örtüşüyor",
      "Risk profili yönetilebilir düzeyde",
      "Uygulama yolu net ve somut",
    ],
    risks: [
      "Paydaş beklentileri netleştirilmeli",
      "Zaman baskısı altında kalite riskine dikkat",
    ],
    objections: ["Alternatif yaklaşımlar yeterince değerlendirilmeli"],
    recommendation: `${request.priority} öncelikle ele alın. Teknik lider onayı alındıktan sonra geliştirmeye başlayın.`,
    confidenceScore: confidenceByPriority(91, request.priority),
  };

  const finalVerdict: FinalVerdict = {
    verdict: `"${request.projectName}" için ${request.requestType} talebi ONAYLANMIŞTIR. ${request.priority} öncelik seviyesi gözetilerek ${request.priority === "Kritik" ? "bu sprint içinde" : request.priority === "Orta" ? "bir sonraki sprint'te" : "backlog'a alınarak"} ele alınmalıdır.`,
    executionPlan: [
      "Gereksinim dokümanı hazırla",
      "Teknik tasarım onaylat",
      "Staging'de geliştir",
      "Code review yap",
      `${request.repoRequired ? "Repo bağlantısıyla birlikte p" : "P"}roduction'a deploy et`,
    ],
    rejectedSuggestions: [
      "Hotfix olarak direkt production'a deploy etme",
      "Test sürecini atlayarak hızlı çözüm üretme",
      "Mevcut bileşenleri tamamen yeniden yazma",
    ],
    risks: risks.slice(0, 2),
    nextAction: `İlk adım olarak ${request.expectedOutput.toLowerCase()} çıktısı üretin ve teknik lider ile paylaşın. Ardından geliştirme ortamında prototip oluşturun.`,
    confidenceScore: confidenceByPriority(89, request.priority),
  };

  const promptOutput = generatePromptOutput(
    request,
    claudeAnalysis,
    codexAnalysis,
    finalVerdict,
    request.attachments ?? []
  );

  return {
    requestId: request.id,
    analyses: [claudeAnalysis, codexAnalysis, chatgptAnalysis],
    finalVerdict,
    promptOutput,
    createdAt: new Date(),
  };
}
