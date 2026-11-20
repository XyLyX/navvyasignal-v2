-- NavvyaSignal shadow publication store. Do NOT apply to another venture's database.
-- Private schema; server-only role access granted separately after role audit.
begin;
create schema if not exists publication_shadow;
revoke all on schema publication_shadow from public, anon, authenticated;
create table if not exists publication_shadow.editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','approved','frozen','published','withdrawn')),
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz,
  approved_by text,
  frozen_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (edition_date,version),
  check (status not in ('approved','frozen','published') or (approved_at is not null and approved_by is not null and content_hash is not null)),
  check (status not in ('frozen','published') or frozen_at is not null),
  check (status <> 'published' or published_at is not null)
);
create table if not exists publication_shadow.entries (
  edition_id uuid not null references publication_shadow.editions(id) on delete restrict,
  source_page_id text not null,
  ordinal integer not null check (ordinal > 0),
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  primary key (edition_id,source_page_id),
  unique (edition_id,ordinal)
);
create table if not exists publication_shadow.outbox (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references publication_shadow.editions(id) on delete restrict,
  channel text not null check (channel in ('website','email','whatsapp')),
  status text not null default 'pending' check (status in ('pending','leased','delivered','ambiguous','dead_letter')),
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (edition_id,channel,idempotency_key)
);
create table if not exists publication_shadow.delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references publication_shadow.outbox(id) on delete restrict,
  provider text not null,
  provider_message_id text not null,
  delivery_state text not null,
  confirmed_at timestamptz not null default now(),
  unique (provider,provider_message_id)
);
create table if not exists publication_shadow.audit (
  id bigint generated always as identity primary key,
  edition_id uuid references publication_shadow.editions(id) on delete restrict,
  actor text not null,
  action text not null,
  prior_hash text,
  new_hash text,
  occurred_at timestamptz not null default now()
);
-- Block mutations of an edition's contents once approved; revisions must use a new version.
create or replace function publication_shadow.guard_entries() returns trigger
language plpgsql security invoker set search_path = pg_catalog, publication_shadow as $$
declare v_status text;
begin
  select status into v_status from publication_shadow.editions
    where id = coalesce(new.edition_id,old.edition_id) for update;
  if v_status is null or v_status <> 'draft' then
    raise exception 'Edition contents are immutable after approval';
  end if;
  return coalesce(new,old);
end $$;
create trigger guard_entry_mutations before insert or update or delete on publication_shadow.entries
for each row execute function publication_shadow.guard_entries();
-- No browser-facing policies. All operations require explicitly granted server privileges.
alter table publication_shadow.editions enable row level security;
alter table publication_shadow.entries enable row level security;
alter table publication_shadow.outbox enable row level security;
alter table publication_shadow.delivery_receipts enable row level security;
alter table publication_shadow.audit enable row level security;
revoke all on all tables in schema publication_shadow from public, anon, authenticated;
revoke all on all sequences in schema publication_shadow from public, anon, authenticated;
revoke all on function publication_shadow.guard_entries() from public, anon, authenticated;
commit;
