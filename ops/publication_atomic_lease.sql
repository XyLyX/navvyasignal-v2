-- Staged schema only: apply to a dedicated NavvyaSignal PostgreSQL database after review.
-- Notion ledger updates are NOT atomic; this table serializes independent publishers.
create schema if not exists publication_private;
create table if not exists publication_private.leases (
  resource text primary key,
  owner uuid not null,
  fencing_token bigint not null default 1,
  expires_at timestamptz not null,
  phase text not null check (phase in ('claimed','build_requested','verified','ambiguous')),
  fingerprint text not null,
  updated_at timestamptz not null default clock_timestamp()
);
revoke all on schema publication_private from public, anon, authenticated;
revoke all on all tables in schema publication_private from public, anon, authenticated;
-- All calls use a dedicated server-only database role; never a browser key.
-- Single-statement CAS: expired unrequested claims may be stolen. A verified\n-- publication permits a DIFFERENT fingerprint, but never replays the same one.\n-- Build-requested and ambiguous records are never automatically reclaimed.
create or replace function publication_private.claim_lease(
  p_resource text, p_owner uuid, p_fingerprint text, p_ttl interval
) returns table(acquired boolean, token bigint, phase text)
language plpgsql security invoker set search_path = pg_catalog, publication_private as $$
begin
  if p_ttl <= interval '0 seconds' or p_ttl > interval '10 minutes'
     or length(p_resource) not between 1 and 200 or length(p_fingerprint) <> 64 then
    raise exception 'Invalid publication lease parameters';
  end if;
  return query
  insert into publication_private.leases as l(resource,owner,fingerprint,expires_at,phase)
  values (p_resource,p_owner,p_fingerprint,clock_timestamp()+p_ttl,'claimed')
  on conflict (resource) do update
    set owner=excluded.owner, fingerprint=excluded.fingerprint,
        expires_at=excluded.expires_at, fencing_token=l.fencing_token+1,
        phase='claimed', updated_at=clock_timestamp()
    where (l.expires_at < clock_timestamp() and l.phase='claimed')\n       or (l.phase='verified' and l.fingerprint <> excluded.fingerprint)
  returning true,l.fencing_token,l.phase;
  if not found then return query select false, null::bigint, null::text; end if;
end $$;
-- State transitions are fenced. A timed-out build is ambiguous and must be reconciled,
-- never automatically reclaimed and replayed.
create or replace function publication_private.transition_lease(
 p_resource text,p_owner uuid,p_token bigint,p_from text,p_to text
) returns boolean language plpgsql security invoker set search_path = pg_catalog, publication_private as $$
declare changed integer;
begin
 if not ((p_from='claimed' and p_to='build_requested') or
         (p_from='build_requested' and p_to in ('verified','ambiguous')) or
         (p_from='ambiguous' and p_to='verified')) then
    raise exception 'Invalid publication lease transition';
 end if;
 update publication_private.leases set phase=p_to,updated_at=clock_timestamp()
 where resource=p_resource and owner=p_owner and fencing_token=p_token
   and phase=p_from and expires_at>=clock_timestamp();
 get diagnostics changed = row_count;
 return changed=1;
end $$;
revoke all on function publication_private.claim_lease(text,uuid,text,interval) from public,anon,authenticated;
revoke all on function publication_private.transition_lease(text,uuid,bigint,text,text) from public,anon,authenticated;
