create table if not exists public.public_site_metrics (
  metric_key text primary key,
  metric_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  check (metric_value >= 0)
);

alter table public.public_site_metrics enable row level security;

revoke all on table public.public_site_metrics from anon, authenticated;
grant select on table public.public_site_metrics to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_site_metrics'
      and policyname = 'public site metrics are viewable by everyone'
  ) then
    create policy "public site metrics are viewable by everyone"
      on public.public_site_metrics
      for select
      using (true);
  end if;
end $$;

insert into public.public_site_metrics (metric_key, metric_value)
values ('cases_solved', (select count(*)::bigint from public.attempts))
on conflict (metric_key)
do update set
  metric_value = excluded.metric_value,
  updated_at = now();

create or replace function public.increment_cases_solved_metric()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_site_metrics (metric_key, metric_value, updated_at)
  values ('cases_solved', 1, now())
  on conflict (metric_key)
  do update set
    metric_value = public.public_site_metrics.metric_value + 1,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists attempts_increment_cases_solved_metric on public.attempts;

create trigger attempts_increment_cases_solved_metric
after insert on public.attempts
for each row
execute function public.increment_cases_solved_metric();
