import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GithubRepoApiItem = {
  full_name?: string;
  html_url?: string;
  private?: boolean;
  default_branch?: string;
  updated_at?: string;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("gh_access_token")?.value;
  if (!token) {
    return NextResponse.json({ connected: false, repos: [] });
  }

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "VerdictAI",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ connected: false, repos: [], error: "token_invalid" }, { status: 401 });
    }

    if (!res.ok) {
      return NextResponse.json({ connected: true, repos: [], error: "github_api_error" }, { status: 502 });
    }

    const data = (await res.json()) as GithubRepoApiItem[];
    const repos = data
      .filter((repo) => repo.full_name && repo.html_url)
      .map((repo) => ({
        fullName: repo.full_name!,
        htmlUrl: repo.html_url!,
        private: repo.private === true,
        defaultBranch: repo.default_branch ?? "main",
        updatedAt: repo.updated_at ?? null,
      }));

    return NextResponse.json({ connected: true, repos });
  } catch {
    return NextResponse.json({ connected: true, repos: [], error: "network" }, { status: 502 });
  }
}
