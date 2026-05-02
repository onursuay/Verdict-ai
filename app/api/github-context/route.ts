// FAZ 2A — GitHub repo context endpoint.
// POST { githubRepoUrl, problem?, requestType?, projectName? }
// Response: { source, owner, repo, branch, selectedFiles, warnings, fetchedAt, contextText, errorMessage? }
//
// Güvenlik:
//  - GITHUB_TOKEN frontend'e dönmez.
//  - Hata mesajları kullanıcıya yönelik sade Türkçe metindir; stack trace çıkmaz.
//  - Sadece text/code dosyalar okunur; binary'ler ve büyük dosyalar dışarıda kalır.

import { NextRequest, NextResponse } from "next/server";
import { buildRepoContext } from "@/lib/github/build-repo-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { githubRepoUrl?: string; problem?: string; requestType?: string; projectName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const githubRepoUrl = (body.githubRepoUrl ?? "").trim();
  if (!githubRepoUrl) {
    return NextResponse.json({ error: "githubRepoUrl gereklidir." }, { status: 400 });
  }

  try {
    const { meta, contextText } = await buildRepoContext({
      githubRepoUrl,
      problem: body.problem,
      requestType: body.requestType,
      projectName: body.projectName,
    });

    return NextResponse.json({
      source: meta.source,
      owner: meta.owner,
      repo: meta.repo,
      branch: meta.branch,
      selectedFiles: meta.selectedFiles,
      warnings: meta.warnings,
      fetchedAt: meta.fetchedAt,
      contextText,
      ...(meta.errorMessage ? { errorMessage: meta.errorMessage } : {}),
    });
  } catch (e) {
    // buildRepoContext throw etmemeli ama emin olalım — son barikat.
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.warn("[verdict-ai] github-context unexpected error:", msg);
    return NextResponse.json({ error: "GitHub bağlamı alınırken beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
