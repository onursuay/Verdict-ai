import { getSupabaseServer } from "../supabase-server";
import { decryptToken, encryptToken } from "../credentials/encryption";

export interface SupabaseConnectionRow {
  id: string;
  user_key: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  scope: string | null;
  account_label: string | null;
  organization_slug: string | null;
  revoked: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseConnection {
  id: string;
  userKey: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  accountLabel: string | null;
  organizationSlug: string | null;
}

export async function saveSupabaseConnection(params: {
  userKey: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  accountLabel?: string | null;
  organizationSlug?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, error: "supabase_unavailable" };

  // Önce aynı user_key için aktif kayıtları revoked yap.
  await supabase
    .from("supabase_connections")
    .update({ revoked: true, updated_at: new Date().toISOString() })
    .eq("user_key", params.userKey)
    .eq("revoked", false);

  const insert = {
    user_key: params.userKey,
    access_token_encrypted: encryptToken(params.accessToken),
    refresh_token_encrypted: params.refreshToken ? encryptToken(params.refreshToken) : null,
    expires_at: params.expiresAt ? params.expiresAt.toISOString() : null,
    scope: params.scope ?? null,
    account_label: params.accountLabel ?? null,
    organization_slug: params.organizationSlug ?? null,
  };

  const { data, error } = await supabase
    .from("supabase_connections")
    .insert(insert)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function getActiveSupabaseConnection(userKey: string): Promise<SupabaseConnection | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("supabase_connections")
    .select("*")
    .eq("user_key", userKey)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as SupabaseConnectionRow;
  try {
    return {
      id: row.id,
      userKey: row.user_key,
      accessToken: decryptToken(row.access_token_encrypted),
      refreshToken: row.refresh_token_encrypted ? decryptToken(row.refresh_token_encrypted) : null,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      scope: row.scope,
      accountLabel: row.account_label,
      organizationSlug: row.organization_slug,
    };
  } catch {
    return null;
  }
}

export async function updateSupabaseConnectionTokens(
  id: string,
  params: { accessToken: string; refreshToken?: string | null; expiresAt?: Date | null }
): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase) return false;

  const update: Record<string, unknown> = {
    access_token_encrypted: encryptToken(params.accessToken),
    updated_at: new Date().toISOString(),
  };
  if (params.refreshToken !== undefined) {
    update.refresh_token_encrypted = params.refreshToken ? encryptToken(params.refreshToken) : null;
  }
  if (params.expiresAt !== undefined) {
    update.expires_at = params.expiresAt ? params.expiresAt.toISOString() : null;
  }

  const { error } = await supabase.from("supabase_connections").update(update).eq("id", id);
  return !error;
}

export async function revokeSupabaseConnection(userKey: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase) return false;
  const { error } = await supabase
    .from("supabase_connections")
    .update({ revoked: true, updated_at: new Date().toISOString() })
    .eq("user_key", userKey)
    .eq("revoked", false);
  return !error;
}
