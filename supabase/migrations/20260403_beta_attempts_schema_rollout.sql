alter table public.attempts
  add column if not exists content_version text;

truncate table public.attempts;

alter table public.attempts
  alter column step_results_json set default '[]'::jsonb;

alter table public.attempts
  alter column archetype set not null,
  alter column final_diagnosis_correct set not null,
  alter column step_results_json set not null,
  alter column content_version set not null;

create index if not exists attempts_user_id_completed_at_idx
  on public.attempts (user_id, completed_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_elapsed_seconds_nonnegative_chk'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_elapsed_seconds_nonnegative_chk
      check (elapsed_seconds >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_correct_steps_nonnegative_chk'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_correct_steps_nonnegative_chk
      check (correct_steps >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_total_steps_positive_chk'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_total_steps_positive_chk
      check (total_steps > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_correct_steps_lte_total_steps_chk'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_correct_steps_lte_total_steps_chk
      check (correct_steps <= total_steps);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_accuracy_percent_range_chk'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_accuracy_percent_range_chk
      check (accuracy_percent >= 0 and accuracy_percent <= 100);
  end if;
end $$;
