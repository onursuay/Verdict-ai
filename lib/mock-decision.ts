import { DecisionRequest, DecisionResult } from "@/types/decision";

export function generateMockDecision(request: DecisionRequest): DecisionResult {
  const riskMap: Record<string, string[]> = {
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

  const feasibilityMap: Record<string, string> = {
    Hata: "Yüksek — standart hata düzeltme süreci takip edilebilir.",
    "Yeni Özellik":
      "Orta — gereksinim analizi tamamlandıktan sonra sprint planlaması yapılabilir.",
    "Mimari Karar":
      "Orta-Düşük — kapsamlı teknik değerlendirme ve paydaş onayı gerekli.",
    "UI/UX Kararı": "Yüksek — prototip üretilip A/B test ile doğrulanabilir.",
    "API Entegrasyonu":
      "Orta — sandbox ortamında doğrulama sonrası uygulanabilir.",
    Güvenlik:
      "Kritik — derhal ele alınmalı, diğer geliştirmeler askıya alınabilir.",
    Diğer: "Belirsiz — önce gereksinim netleştirilmeli.",
  };

  const risks = riskMap[request.requestType] ?? riskMap["Diğer"];
  const feasibility =
    feasibilityMap[request.requestType] ?? feasibilityMap["Diğer"];

  const priorityPrefix =
    request.priority === "Kritik"
      ? "ACİL: "
      : request.priority === "Orta"
        ? "ÖNEMLİ: "
        : "";

  return {
    requestId: request.id,
    claudeAnalysis: {
      engineerOpinion: `${priorityPrefix}"${request.projectName}" projesi için ${request.requestType.toLowerCase()} talebi incelenmiştir. ${request.description.slice(0, 120)}... Teknik açıdan bu talep, mevcut sistem mimarisiyle uyumlu biçimde hayata geçirilebilir. Standart geliştirme pratiklerine uyulduğu takdirde hedeflenen çıktıya ulaşılması mümkündür.`,
      feasibility,
      risks,
    },
    codexReview: {
      codeRisk:
        request.priority === "Kritik"
          ? "YÜKSEKİ — Kod tabanında breaking change ihtimali var. Kapsamlı regression testi şart."
          : "ORTA — Değişiklik lokalize görünüyor, ancak bağımlı modüller kontrol edilmeli.",
      testRisk:
        "Birim testlerinin mevcut coverage'ı yeterli olmayabilir. Entegrasyon testleri eklenmeli.",
      alternativeSuggestion: `Feature flag kullanarak kademeli rollout yapılması önerilebilir. Bu sayede ${request.projectName} projesi etkilenmeden A/B test yapılabilir.`,
    },
    chatGPTVerdict: {
      finalDecision: `"${request.projectName}" için ${request.requestType} talebi ONAYLANMIŞTIR. ${request.priority} öncelik seviyesi gözetilerek ${request.priority === "Kritik" ? "bu sprint içinde" : request.priority === "Orta" ? "bir sonraki sprint'te" : "backlog'a alınarak"} ele alınmalıdır.`,
      implementationPath: `1. Gereksinim dokümanı hazırla → 2. Teknik tasarım onaylat → 3. Staging'de geliştir → 4. Code review yap → 5. ${request.repoRequired ? "Repo bağlantısıyla birlikte" : ""} Production'a deploy et`,
      rejectedSuggestions: [
        "Hotfix olarak direkt production'a deploy etme",
        "Test sürecini atlayarak hızlı çözüm üretme",
        "Mevcut bileşenleri tamamen yeniden yazma",
      ],
      nextAction: `İlk adım olarak ${request.expectedOutput.toLowerCase()} çıktısı üretin ve teknik lider ile paylaşın. Ardından geliştirme ortamında prototip oluşturun.`,
    },
    generatedPrompt: `Sen deneyimli bir yazılım mimarısın. Aşağıdaki talep için detaylı bir uygulama planı oluştur:

**Proje:** ${request.projectName}
**Talep Tipi:** ${request.requestType}
**Öncelik:** ${request.priority}
**Açıklama:** ${request.description}
**Beklenen Çıktı:** ${request.expectedOutput}
${request.repoRequired ? "**Not:** Repo erişimi gerekli\n" : ""}
Lütfen şunları kapsa:
1. Adım adım uygulama planı
2. Gerekli dosya ve modüller
3. Potansiyel riskler ve önlemler
4. Test stratejisi
5. Tahmini süre

Yanıtını Türkçe olarak, teknik ama anlaşılır biçimde ver.`,
    status: "pending",
    createdAt: new Date(),
  };
}
