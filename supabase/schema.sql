-- Verdict AI — decision_records tablosu
-- Supabase SQL Editor'de veya supabase db push ile çalıştırın.

create table if not exists decision_records (
  id             uuid        primary key default gen_random_uuid(),
  project_name   text        not null,
  request_type   text        not null,
  priority       text        not null,
  problem        text        not null,
  expected_output text       not null,
  repo_required  boolean     not null default false,
  status         text        not null default 'completed',
  claude_source  text,
  codex_source   text,
  judge_source   text,
  request_json   jsonb       not null,
  result_json    jsonb       not null,
  created_at     timestamptz not null default now()
);

-- Migration: attachments_json alanı ekle (tablo zaten varsa)
alter table decision_records
  add column if not exists attachments_json jsonb;

-- Migration: implementation_tasks tablosu
create table if not exists implementation_tasks (
  id                  uuid        primary key default gen_random_uuid(),
  decision_record_id  uuid        references decision_records(id) on delete set null,
  target_tool         text        not null default 'Claude Code',
  status              text        not null default 'queued',
  prompt_title        text,
  prompt_body         text,
  result_summary      text,
  result_json         jsonb,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Status değerleri: queued | sent | running | completed | failed | review_required

-- Migration: supabase_connections tablosu (Supabase OAuth bağlantıları)
-- Token'lar AES-256-GCM ile şifrelenmiş olarak saklanır.
create table if not exists supabase_connections (
  id                       uuid        primary key default gen_random_uuid(),
  provider                 text        not null default 'supabase',
  user_key                 text        not null,
  access_token_encrypted   text        not null,
  refresh_token_encrypted  text,
  expires_at               timestamptz,
  scope                    text,
  account_label            text,
  organization_slug        text,
  revoked                  boolean     not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists supabase_connections_user_key_idx
  on supabase_connections (user_key)
  where revoked = false;
