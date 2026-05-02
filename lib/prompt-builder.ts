import { AIAnalysis, DecisionAttachment, DecisionRequest, FinalVerdict, PromptOutput, RepoContextSource, RequestType } from "@/types/decision";

function buildTypeSection(requestType: RequestType | string): string {
  switch (requestType) {
    case "Hata":
      return `

## Hata Teşhisi — Teknik Görevler
1. Kök neden analizi yap: hatanın tam olarak nerede ve neden oluştuğunu tespit et.
2. İlgili dosya ve satırları belirt; yalnızca gerekli minimum değişikliği uygula.
3. Yandan etkilenebilecek modülleri kontrol et (regresyon riski).
4. \`npm run build\` ve projenin test komutunu çalıştır.
5. Build/test sonucunu ve değiştirilen kod bölümlerini raporla.`;

    case "Yeni Özellik":
      return `

## Yeni Özellik — Uygulama Görevleri
1. Kapsam netleştirilecek: hangi dosyalar/modüller etkilenecek, sınır nerede?
2. UI / Backend / DB katmanlarını ayrı ayrı ele al.
3. Mevcut kodu önce oku; yeni dosya açmadan önce mevcut yapıya entegrasyonu değerlendir.
4. Her bileşen için temel test senaryoları yaz.
5. Mevcut özelliklerde regresyon kontrolü yap.
6. Build çalıştır; golden path + edge case sonuçlarını raporla.`;

    case "Mimari Karar":
      return `

## Mimari Karar — Analiz Görevleri
1. Mevcut yapıyı incele: ilgili servis/modül/bileşen bağımlılıklarını haritala.
2. Karar gerekçesini dokümante et (bu yol neden seçildi, alternatifler neden reddedildi).
3. Değişmeyecek sınırları net tanımla (API kontratı, DB şeması, event formatları vb.).
4. Uygulanacak teknik yolu adım adım belirt.
5. Risk ve geri alma senaryosunu raporla.`;

    case "UI/UX Kararı":
      return `

## UI/UX Kararı — Uygulama Görevleri
1. Yalnızca UI katmanında çalış; veri/iş mantığına kesinlikle dokunma.
2. Değişiklik yapılacak bileşenleri ve stilleri önceden belirt.
3. Responsive kontrol: mobile (375px), tablet (768px), desktop (1280px).
4. Alignment, boşluk tutarlılığı ve temel accessibility (aria-label, kontrast) kontrol et.
5. Tarayıcı konsolunda hata kalmamalı.
6. DOM değişiklik özetini ve ekran görüntüsünü raporla.`;

    case "API Entegrasyonu":
      return `

## API Entegrasyonu — Güvenlik & Teknik Görevler
1. Tüm env/secret değerleri yalnızca server-side kullanılacak; client-side sızdırma kesinlikle yasak.
2. Rate limit senaryosu: servis 429/503 döndürdüğünde graceful fallback eklenmeli.
3. Error handling: her API çağrısı try/catch ile sarılmalı; hata loglanacak.
4. Timeout konfigürasyonu ekle (önerilen üst limit: 10 saniye).
5. Staging ortamında test et; mock/sandbox doğrulaması production öncesi zorunlu.
6. API call sayısı, hata oranı ve fallback davranışını raporla.`;

    case "Güvenlik":
      return `

## Güvenlik — Kritik Görevler
1. Hiçbir secret, token veya key client-side gönderilmeyecek; tüm hassas işlemler server-side.
2. Kullanıcı girdileri sanitize edilecek (XSS, SQL/NoSQL injection koruması).
3. Güvenlik olayları loglanacak (başarısız auth girişimleri, anormal erişim örüntüleri vb.).
4. Rollback planı: hata durumunda geri alma prosedürü belirtilecek.
5. OWASP Top-10 kapsamında kontrol yapılacak.
6. Değişiklik öncesi ve sonrası güvenlik durumunu karşılaştırmalı raporla.`;

    default:
      return `

## Genel Görevler
1. Problemi yeniden tanımla: tam olarak ne yapılıyor ve ne bekleniyor?
2. Minimum değişiklik prensibi: yalnızca gerekli alanları etkile.
3. Build/test çalıştır; sonuçları raporla.`;
  }
}

function buildCoinBotSafety(): string {
  return `

## ⚠️ GÜVENLİK KURALLARI — CoinBot Kritik Kısıtlamalar
Bu kuralları ihlal eden herhangi bir değişiklik onaylanmaz. Her adımda bu listeyi kontrol et:

- YASAK: Live trading açılmayacak. Tüm işlemler paper/test modunda kalacak.
- YASAK: MIN_SIGNAL_CONFIDENCE veya herhangi bir güven/eşik parametresi değiştirilmeyecek.
- YASAK: BTC trend filtresi veya piyasa kalitesi filtreleri gevşetilmeyecek.
- YASAK: Risk gate, SL/TP, R:R oranı, likidite/spread/derinlik filtreleri değiştirilmeyecek.
- YASAK: Trade açma mantığına dokunulmayacak (yalnızca teşhis/loglama/açıklanabilirlik amacıyla yapılan değişiklikler istisnadır).
- ZORUNLU: Her değişiklikten sonra build + test raporu verilecek.
- ZORUNLU: Değişiklik yalnızca belirtilen kapsamla sınırlı kalacak; kapsam dışına çıkmadan önce kullanıcı onayı alınacak.`;
}

function buildReportFormat(requestType: RequestType | string): string {
  const header = `

## Rapor Formatı (Görev Tamamlandığında)`;

  switch (requestType) {
    case "Hata":
      return header + `
- Kök neden: [açıklama]
- Değiştirilen dosyalar: [liste]
- Test sonucu: [PASS/FAIL + detay]
- Regresyon kontrolü: [etkilenen modüller ve sonuç]`;

    case "Yeni Özellik":
      return header + `
- Eklenen bileşenler/dosyalar: [liste]
- UI/Backend/DB değişiklikleri: [özet]
- Test senaryoları: [PASS/FAIL]
- Bilinen kısıtlamalar: [varsa]`;

    case "Mimari Karar":
      return header + `
- Uygulanan mimari değişiklik: [özet]
- Etkilenen bileşenler: [liste]
- Korunan sınırlar: [kontrol edildi/edilmedi]
- Risk değerlendirmesi: [güncellendi mi?]`;

    case "UI/UX Kararı":
      return header + `
- Değiştirilen bileşenler: [liste]
- Responsive test: [mobile/tablet/desktop durumu]
- Konsol hataları: [temiz/sorunlu]`;

    case "API Entegrasyonu":
      return header + `
- Entegre edilen endpoint(ler): [liste]
- Güvenlik kontrolleri: [server-side doğrulandı mı?]
- Hata/fallback testi: [PASS/FAIL]
- Rate limit senaryosu: [test edildi mi?]`;

    case "Güvenlik":
      return header + `
- Kapatılan açık(lar): [açıklama]
- Server-side doğrulama: [var/yok]
- Audit log: [eklendi/yok]
- OWASP kontrol: [yapıldı/yapılmadı]`;

    default:
      return header + `
- Yapılan değişiklikler: [özet]
- Build/test: [sonuç]
- Açık konular: [varsa]`;
  }
}

function buildRepoContextSection(repoContext: RepoContextSource | null | undefined, hasLocalPath: boolean): string {
  if (!repoContext) return "";
  if (repoContext.errorMessage) {
    return `\n\n## GitHub Kod Bağlamı\n_GitHub kod bağlamı alınamadı: ${repoContext.errorMessage}_`;
  }
  if (!repoContext.selectedFiles.length) {
    return `\n\n## GitHub Kod Bağlamı\n- Repo: ${repoContext.owner}/${repoContext.repo}\n- Branch: ${repoContext.branch}\n_Alakalı text/code dosyası bulunamadı._`;
  }
  const fileList = repoContext.selectedFiles
    .map((f) => `- ${f.path} (${f.language}, ~${(f.size / 1024).toFixed(1)} KB)`)
    .join("\n");
  const localNote = hasLocalPath
    ? `\n\n_Uygulama için lokal proje yolu önceliklidir. GitHub bağlamı referans olarak kullanılmıştır._`
    : "";
  return `\n\n## GitHub Kod Bağlamı\n- Repo: ${repoContext.owner}/${repoContext.repo}\n- Branch: ${repoContext.branch}\n- İncelenen dosyalar:\n${fileList}${localNote}`;
}

function buildProjectContextSection(req: DecisionRequest): string {
  const ctx = req.projectContext;
  const hasContext = !!ctx && (
    !!ctx.githubRepoUrl ||
    !!ctx.localProjectPath ||
    !!ctx.liveUrl ||
    !!ctx.vercelProjectUrl ||
    !!ctx.vpsHost ||
    !!ctx.supabaseProjectUrl ||
    !!ctx.notes
  );

  if (req.repoRequired && !hasContext) {
    return `\n\n## Proje Bağlamı\n_Repo analizi istendi ancak GitHub repo URL'i veya lokal proje yolu sağlanmadı. Kod erişimi doğrulanmadan kesin kod analizi yapma._`;
  }

  if (!hasContext) return "";

  const lines: string[] = [];
  if (ctx?.githubRepoUrl) lines.push(`- GitHub Repo: ${ctx.githubRepoUrl}`);
  if (ctx?.localProjectPath) lines.push(`- Lokal Proje Yolu: ${ctx.localProjectPath}`);
  if (ctx?.liveUrl) lines.push(`- Canlı URL: ${ctx.liveUrl}`);
  if (ctx?.vercelProjectUrl) lines.push(`- Vercel: ${ctx.vercelProjectUrl}`);
  if (ctx?.vpsHost) lines.push(`- VPS / Worker: ${ctx.vpsHost}`);
  if (ctx?.supabaseProjectUrl) lines.push(`- Supabase: ${ctx.supabaseProjectUrl}`);
  if (ctx?.notes) lines.push(`- Notlar: ${ctx.notes}`);

  // Lokal yol varsa Claude Code'a klasör doğrulama talimatı.
  const verifyStep = ctx?.localProjectPath
    ? `\n\nClaude Code için: Önce \`${ctx.localProjectPath}\` klasörüne geç ve \`pwd\` + \`ls\` ile doğru proje olduğunu doğrula. Sonra çalışmaya başla.`
    : "";

  return `\n\n## Proje Bağlamı\n${lines.join("\n")}${verifyStep}`;
}

function normalizePlan(executionPlan: string[]): string[] {
  if (executionPlan.length === 1 && executionPlan[0].includes("→")) {
    return executionPlan[0].split("→").map(s => s.trim()).filter(Boolean);
  }
  return executionPlan;
}

export function generatePromptOutput(
  req: DecisionRequest,
  claude: AIAnalysis,
  codex: AIAnalysis,
  verdict: FinalVerdict,
  attachments: DecisionAttachment[],
  repoContext?: RepoContextSource | null
): PromptOutput {
  const isCoinBot = /coinbot|coin[_\s-]?bot/i.test(req.projectName);

  const planSteps = normalizePlan(verdict.executionPlan);
  const executionSteps = planSteps.map((step, i) => `${i + 1}. ${step}`).join("\n");

  // Forbidden/rejected suggestions
  const forbiddenLines = verdict.rejectedSuggestions
    .filter(s => s.trim().length > 0)
    .map(s => `- ${s}`);
  const forbiddenSection = forbiddenLines.length
    ? `\n\n## Yapılmayacaklar\n${forbiddenLines.join("\n")}`
    : "";

  // Protected areas from both Claude risks and verdict risks (deduplicated)
  const allRisks = [...new Set([...claude.risks.slice(0, 2), ...verdict.risks.slice(0, 2)])].slice(0, 4);
  const protectedSection = allRisks.length
    ? `\n\n## Korunacak Alanlar / Riskler\n${allRisks.map(r => `- ${r}`).join("\n")}`
    : "";

  // Attachment context (only analyzed content)
  const attLines = attachments
    .filter(a => a.contentSummary || a.contentText)
    .map(a => {
      if (a.contentSummary) return `- ${a.name}: ${a.contentSummary.slice(0, 200).replace(/\n/g, " ")}`;
      if (a.contentText) return `- ${a.name}: [Metin içeriği mevcut, ${(a.size / 1024).toFixed(0)} KB]`;
      return null;
    })
    .filter((x): x is string => x !== null);
  const attSection = attLines.length
    ? `\n\n## Referans Dosyalar\n${attLines.join("\n")}`
    : "";

  const typeSection = buildTypeSection(req.requestType);
  const safetySection = isCoinBot ? buildCoinBotSafety() : "";
  const reportSection = buildReportFormat(req.requestType);
  const projectContextSection = buildProjectContextSection(req);
  const repoContextSection = buildRepoContextSection(repoContext, !!req.projectContext?.localProjectPath?.trim());

  const body =
`# ${req.requestType} — ${req.projectName}

## Görev Bağlamı
- Proje: ${req.projectName}
- Talep Tipi: ${req.requestType}
- Öncelik: ${req.priority}
- Problem: ${req.problem}
- Beklenen Çıktı: ${req.expectedOutput}${req.repoRequired ? "\n- Repo: Erişim gerekli" : ""}${projectContextSection}${repoContextSection}

## Nihai Karar (Hakem)
${verdict.verdict}
Güven skoru: %${verdict.confidenceScore}

## Uygulama Planı
${executionSteps}${forbiddenSection}${protectedSection}

## Mühendis Analizleri

### Claude Mühendis (%${claude.confidenceScore})
${claude.summary}
Öneri: ${claude.recommendation}

### Codex Denetçisi (%${codex.confidenceScore})
${codex.summary}
Öneri: ${codex.recommendation}${typeSection}${attSection}${safetySection}

## İlk Adım
${verdict.nextAction}${reportSection}`;

  return {
    targetTool: "Claude Code",
    promptTitle: `${req.requestType} — ${req.projectName} (${req.priority})`,
    promptBody: body.trim(),
  };
}
