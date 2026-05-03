import {
  getActiveSupabaseConnection,
  updateSupabaseConnectionTokens,
} from "./connection-store";

const MANAGEMENT_API = "https://api.supabase.com";

export interface SupabaseProjectSummary {
  ref: string;
  name: string;
  region: string;
  organization_id: string;
  created_at: string;
}

export type ManagementApiError =
  | "no_connection"
  | "token_expired"
  | "auth_failed"
  | "insufficient_scope"
  | "rate_limit"
  | "network"
  | "unknown";

export interface ManagementApiResult<T> {
  ok: boolean;
  data?: T;
  error?: ManagementApiError;
  errorDetail?: string;
}

async function refreshAccessToken(
  connectionId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null } | null> {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(`${MANAGEMENT_API}/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;
    const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    const accessToken = data.access_token;
    const newRefreshToken = data.refresh_token ?? refreshToken;
    await updateSupabaseConnectionTokens(connectionId, {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    });
    return { accessToken, refreshToken: newRefreshToken, expiresAt };
  } catch {
    return null;
  }
}

async function authedFetch(
  userKey: string,
  path: string,
  init?: RequestInit
): Promise<Response | { error: ManagementApiError }> {
  const conn = await getActiveSupabaseConnection(userKey);
  if (!conn) return { error: "no_connection" };

  let token = conn.accessToken;
  if (conn.expiresAt && conn.expiresAt.getTime() < Date.now() + 30_000) {
    if (!conn.refreshToken) return { error: "token_expired" };
    const refreshed = await refreshAccessToken(conn.id, conn.refreshToken);
    if (!refreshed) return { error: "token_expired" };
    token = refreshed.accessToken;
  }

  const res = await fetch(`${MANAGEMENT_API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  // Token expired sırasında 401 dönerse refresh dene
  if (res.status === 401 && conn.refreshToken) {
    const refreshed = await refreshAccessToken(conn.id, conn.refreshToken);
    if (refreshed) {
      return fetch(`${MANAGEMENT_API}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${refreshed.accessToken}`,
          Accept: "application/json",
        },
      });
    }
    return { error: "token_expired" };
  }

  return res;
}

function mapHttpError(status: number): ManagementApiError {
  if (status === 401) return "auth_failed";
  if (status === 403) return "insufficient_scope";
  if (status === 429) return "rate_limit";
  return "unknown";
}

export async function listSupabaseProjects(
  userKey: string
): Promise<ManagementApiResult<SupabaseProjectSummary[]>> {
  const result = await authedFetch(userKey, "/v1/projects");
  if ("error" in result) return { ok: false, error: result.error };
  if (!result.ok) {
    return { ok: false, error: mapHttpError(result.status), errorDetail: `HTTP ${result.status}` };
  }
  try {
    const arr = (await result.json()) as SupabaseProjectSummary[];
    if (!Array.isArray(arr)) return { ok: false, error: "unknown" };
    return {
      ok: true,
      data: arr.map((p) => ({
        ref: p.ref,
        name: p.name,
        region: p.region,
        organization_id: p.organization_id,
        created_at: p.created_at,
      })),
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function getSupabaseProject(
  userKey: string,
  projectRef: string
): Promise<ManagementApiResult<SupabaseProjectSummary>> {
  const result = await authedFetch(userKey, `/v1/projects/${encodeURIComponent(projectRef)}`);
  if ("error" in result) return { ok: false, error: result.error };
  if (!result.ok) {
    return { ok: false, error: mapHttpError(result.status), errorDetail: `HTTP ${result.status}` };
  }
  try {
    const data = (await result.json()) as SupabaseProjectSummary;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function getSupabaseProjectHealth(
  userKey: string,
  projectRef: string
): Promise<ManagementApiResult<unknown>> {
  const result = await authedFetch(
    userKey,
    `/v1/projects/${encodeURIComponent(projectRef)}/health`
  );
  if ("error" in result) return { ok: false, error: result.error };
  if (!result.ok) {
    return { ok: false, error: mapHttpError(result.status), errorDetail: `HTTP ${result.status}` };
  }
  try {
    const data = await result.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchSupabaseAccountInfo(
  accessToken: string
): Promise<{ orgSlug: string | null; orgName: string | null }> {
  try {
    const res = await fetch(`${MANAGEMENT_API}/v1/organizations`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return { orgSlug: null, orgName: null };
    const arr = (await res.json()) as Array<{ slug?: string; name?: string }>;
    if (!Array.isArray(arr) || arr.length === 0) return { orgSlug: null, orgName: null };
    return { orgSlug: arr[0].slug ?? null, orgName: arr[0].name ?? null };
  } catch {
    return { orgSlug: null, orgName: null };
  }
}
