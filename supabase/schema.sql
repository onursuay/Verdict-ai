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
