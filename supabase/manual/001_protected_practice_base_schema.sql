begin;

create extension if not exists pgcrypto;

create table if not exists public.published_cases (
  content_version text not null check (length(trim(content_version)) > 0),
  case_id text not null check (length(trim(case_id)) > 0),
  difficulty_label text not null check (length(trim(difficulty_label)) > 0),
  difficulty_level integer not null check (difficulty_level > 0),
  archetype text not null check (length(trim(archetype)) > 0),
  category text,
  public_payload jsonb not null,
  grading_payload jsonb not null,
  published_at timestamptz not null default timezone('utc', now()),
  primary key (content_version, case_id)
);

create index if not exists published_cases_content_version_difficulty_idx
  on public.published_cases (content_version, difficulty_label);

create index if not exists published_cases_content_version_archetype_idx
  on public.published_cases (content_version, archetype);

create table if not exists public.issued_case_sessions (
  case_token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_version text not null check (length(trim(content_version)) > 0),
  case_id text not null check (length(trim(case_id)) > 0),
  difficulty_label text not null check (length(trim(difficulty_label)) > 0),
  difficulty_level integer not null check (difficulty_level > 0),
  status text not null check (status in ('issued', 'completed', 'expired', 'superseded')),
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  completed_at timestamptz,
  submitted_answers jsonb,
  graded_response jsonb,
  constraint issued_case_sessions_case_fk
    foreign key (content_version, case_id)
    references public.published_cases (content_version, case_id)
    on delete cascade,
  constraint issued_case_sessions_expires_after_issue_chk
    check (expires_at > issued_at),
  constraint issued_case_sessions_completed_payload_chk
    check (
      (status = 'completed' and completed_at is not null and submitted_answers is not null and graded_response is not null)
      or
      (status <> 'completed')
    )
);

create unique index if not exists issued_case_sessions_active_slot_uniq
  on public.issued_case_sessions (user_id, content_version, difficulty_label)
  where status = 'issued';

create index if not exists issued_case_sessions_user_status_expires_idx
  on public.issued_case_sessions (user_id, status, expires_at desc);

create index if not exists issued_case_sessions_user_difficulty_status_idx
  on public.issued_case_sessions (user_id, difficulty_label, status, issued_at desc);

create table if not exists public.practice_prepare_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default timezone('utc', now())
);

create index if not exists practice_prepare_events_user_requested_idx
  on public.practice_prepare_events (user_id, requested_at desc);

alter table public.published_cases enable row level security;
alter table public.issued_case_sessions enable row level security;
alter table public.practice_prepare_events enable row level security;

revoke all on table public.published_cases from public, anon, authenticated;
revoke all on table public.issued_case_sessions from public, anon, authenticated;
revoke all on table public.practice_prepare_events from public, anon, authenticated;

grant select, insert, update, delete on table public.published_cases to service_role;
grant select, insert, update, delete on table public.issued_case_sessions to service_role;
grant select, insert, update, delete on table public.practice_prepare_events to service_role;

commit;
