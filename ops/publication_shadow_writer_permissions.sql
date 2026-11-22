create role navvyasignal_shadow_writer nologin noinherit nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema publication_shadow to navvyasignal_shadow_writer;
grant select on publication_shadow.editions, publication_shadow.entries to navvyasignal_shadow_writer;
grant insert (edition_date, version) on publication_shadow.editions to navvyasignal_shadow_writer;
grant update (entry_revision, status, approved_at, approved_by, content_hash, frozen_at)
  on publication_shadow.editions to navvyasignal_shadow_writer;
grant insert (edition_id, source_page_id, ordinal, payload, payload_hash)
  on publication_shadow.entries to navvyasignal_shadow_writer;
grant insert (edition_id, actor, action, new_hash) on publication_shadow.audit to navvyasignal_shadow_writer;
create policy writer_read_editions on publication_shadow.editions for select to navvyasignal_shadow_writer using (true);
create policy writer_read_entries on publication_shadow.entries for select to navvyasignal_shadow_writer using (true);
create policy writer_insert_editions on publication_shadow.editions for insert to navvyasignal_shadow_writer
  with check (status = 'draft');
create policy writer_update_editions on publication_shadow.editions for update to navvyasignal_shadow_writer
  using (status in ('draft', 'approved', 'frozen'))
  with check (status in ('draft', 'approved', 'frozen'));
create policy writer_insert_entries on publication_shadow.entries for insert to navvyasignal_shadow_writer
  with check (true);
create policy writer_insert_audit on publication_shadow.audit for insert to navvyasignal_shadow_writer
  with check (action = 'manual_verification_and_approval');
