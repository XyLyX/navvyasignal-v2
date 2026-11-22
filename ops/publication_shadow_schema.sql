-- NavvyaSignal shadow publication store. Do NOT apply to another venture's database.
-- Run as one atomic migration. Runtime role provisioning is separate.
-- Hash format: UTF-8 PostgreSQL jsonb text. Edition input is the ordered array
-- of [ordinal, source_page_id, payload_hash] tuples.
create schema publication_shadow;
revoke all on schema publication_shadow from public, anon, authenticated, service_role, authenticator;
create table publication_shadow.editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','approved','frozen','published','withdrawn')),
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz,
  approved_by text,
  frozen_at timestamptz,
  published_at timestamptz,
  entry_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (edition_date,version),
  check (status not in ('approved','frozen','published') or (approved_at is not null and approved_by is not null and content_hash is not null)),
  check (status not in ('frozen','published') or frozen_at is not null),
  check (status <> 'published' or published_at is not null)
);
create table publication_shadow.entries (
  edition_id uuid not null references publication_shadow.editions(id) on delete restrict,
  source_page_id text not null check (btrim(source_page_id) <> ''),
  ordinal integer not null check (ordinal > 0),
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  primary key (edition_id,source_page_id),
  unique (edition_id,ordinal)
);
create table publication_shadow.outbox (
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
  unique (edition_id,channel),
  unique (channel,idempotency_key),
  check (btrim(idempotency_key) <> '')
);
create table publication_shadow.delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references publication_shadow.outbox(id) on delete restrict,
  provider text not null,
  provider_message_id text not null,
  delivery_state text not null,
  confirmed_at timestamptz not null default now(),
  unique (provider,provider_message_id),
  unique (event_id),
  check (btrim(provider) <> '' and btrim(provider_message_id) <> '')
);
create table publication_shadow.audit (
  id bigint generated always as identity primary key,
  edition_id uuid references publication_shadow.editions(id) on delete restrict,
  actor text not null,
  action text not null,
  prior_hash text,
  new_hash text,
  occurred_at timestamptz not null default now()
);
-- Updating the parent serializes approval with entry writes, including at repeatable read.
create function publication_shadow.guard_entries() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
declare
  parent_id uuid;
begin
  if tg_op = 'UPDATE' and new.edition_id <> old.edition_id then
    raise check_violation using message = 'Entries cannot move between editions';
  end if;
  if tg_op = 'DELETE' then
    parent_id := old.edition_id;
  else
    parent_id := new.edition_id;
    if new.payload_hash is distinct from encode(sha256(convert_to(new.payload::text,'UTF8')), 'hex') then
      raise check_violation using message = 'Entry content hash mismatch';
    end if;
  end if;
  update publication_shadow.editions set entry_revision = entry_revision + 1
    where id = parent_id and status = 'draft';
  if not found then
    raise check_violation using message = 'Edition contents require a draft parent';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create function publication_shadow.guard_edition() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
declare
  expected_hash text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise check_violation using message = 'Edition deletion requires a draft';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise check_violation using message = 'New editions must start in draft';
    end if;
  else
    if (new.id,new.edition_date,new.version,new.created_at)
       is distinct from (old.id,old.edition_date,old.version,old.created_at)
       or (old.status <> 'draft' and
          (new.content_hash,new.approved_at,new.approved_by,new.entry_revision)
          is distinct from (old.content_hash,old.approved_at,old.approved_by,old.entry_revision))
       or (old.frozen_at is not null and new.frozen_at is distinct from old.frozen_at)
       or (old.published_at is not null and new.published_at is distinct from old.published_at)
    then raise check_violation using message = 'Immutable edition metadata'; end if;
    if new.status <> old.status and not (
      (old.status,new.status) in (('draft','approved'),('approved','frozen'),('frozen','published'))
      or (new.status = 'withdrawn' and old.status in ('draft','approved','frozen'))
    ) then raise check_violation using message = 'Invalid edition state transition'; end if;
    if old.status = 'draft' and new.status = 'approved' then
      select encode(sha256(convert_to(
        jsonb_agg(jsonb_build_array(e.ordinal,e.source_page_id,e.payload_hash) order by e.ordinal)::text,
        'UTF8')), 'hex') into expected_hash
      from publication_shadow.entries e where e.edition_id = new.id;
      if expected_hash is null or new.content_hash is distinct from expected_hash then
        raise check_violation using message = 'Edition must have entries and a matching content hash';
      end if;
    end if;
  end if;
  if (new.status = 'draft' and (new.approved_at is not null or new.approved_by is not null or new.content_hash is not null))
     or (new.approved_by is not null and btrim(new.approved_by) = '')
     or (new.status in ('draft','approved') and new.frozen_at is not null)
     or (new.status <> 'published' and new.published_at is not null)
     or (new.frozen_at is not null and (new.approved_at is null or new.frozen_at < new.approved_at))
     or (new.published_at is not null and new.published_at < new.frozen_at)
     or (tg_op = 'UPDATE' and new.status = 'withdrawn' and
         (new.approved_at,new.approved_by,new.content_hash,new.frozen_at)
         is distinct from (old.approved_at,old.approved_by,old.content_hash,old.frozen_at))
  then raise check_violation using message = 'Invalid lifecycle metadata'; end if;
  return new;
end $$;

create trigger guard_entry_mutations before insert or update or delete on publication_shadow.entries
for each row execute function publication_shadow.guard_entries();
create trigger guard_edition_mutations before insert or update or delete on publication_shadow.editions
for each row execute function publication_shadow.guard_edition();

create function publication_shadow.guard_outbox_insert() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  perform 1 from publication_shadow.editions where id = new.edition_id and status = 'published' for share;
  if not found or new.status <> 'pending' or new.attempt_count <> 0 or new.lease_until is not null then
    raise check_violation using message = 'New events require a published edition and pending state';
  end if;
  return new;
end $$;

create trigger guard_outbox_insert before insert on publication_shadow.outbox
for each row execute function publication_shadow.guard_outbox_insert();

create function publication_shadow.reject_mutation() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  raise check_violation using message = 'Publication history mutation is forbidden';
end $$;

create trigger audit_append_only before update or delete on publication_shadow.audit
for each row execute function publication_shadow.reject_mutation();
create trigger editions_no_truncate before truncate on publication_shadow.editions
for each statement execute function publication_shadow.reject_mutation();
create trigger entries_no_truncate before truncate on publication_shadow.entries
for each statement execute function publication_shadow.reject_mutation();

create index audit_edition_id_idx on publication_shadow.audit (edition_id);
create index outbox_pending_idx on publication_shadow.outbox (next_attempt_at, id) where status = 'pending';
-- No browser-facing policies. All operations require explicitly granted server privileges.
alter table publication_shadow.editions enable row level security;
alter table publication_shadow.entries enable row level security;
alter table publication_shadow.outbox enable row level security;
alter table publication_shadow.delivery_receipts enable row level security;
alter table publication_shadow.audit enable row level security;
revoke all on all tables in schema publication_shadow from public, anon, authenticated, service_role, authenticator;
revoke all on all sequences in schema publication_shadow from public, anon, authenticated, service_role, authenticator;
revoke all on all functions in schema publication_shadow from public, anon, authenticated, service_role, authenticator;
