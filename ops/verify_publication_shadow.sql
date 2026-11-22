-- Run as the migration owner against the deployed shadow schema.
-- All synthetic rows are rolled back. Errors abort the transaction.
begin;
do $test$
declare e uuid; other uuid; event uuid; h text := encode(sha256(convert_to('{}','UTF8')),'hex'); edition_hash text; browser_role text;
begin
insert into publication_shadow.editions (edition_date,version) values (current_date,2147483647) returning id into e;
insert into publication_shadow.editions (edition_date,version) values (current_date,2147483646) returning id into other;
begin insert into publication_shadow.editions (edition_date,version,status) values (current_date,2147483645,'published'); raise exception 'Expected rejection: direct'; exception when check_violation then null; end;
begin insert into publication_shadow.editions (edition_date,version) values (current_date,2147483647); raise exception 'Expected rejection: version'; exception when unique_violation then null; end;
begin update publication_shadow.editions set status='published' where id=e; raise exception 'Expected rejection: publish_draft'; exception when check_violation then null; end;
begin update publication_shadow.editions set status='approved',approved_at=now(),approved_by='test',content_hash=h where id=e; raise exception 'Expected rejection: empty_approve'; exception when check_violation then null; end;
begin insert into publication_shadow.entries values(e,'a',1,'{}',repeat('0',64)); raise exception 'Expected rejection: hash'; exception when check_violation then null; end;
begin insert into publication_shadow.outbox(edition_id,channel,idempotency_key) values(e,'website','test'); raise exception 'Expected rejection: draft_outbox'; exception when check_violation then null; end;
insert into publication_shadow.entries values(e,'a',1,'{}',h);
begin insert into publication_shadow.entries values(e,'b',1,'{}',h); raise exception 'Expected rejection: ordinal'; exception when unique_violation then null; end;
edition_hash := encode(sha256(convert_to(jsonb_build_array(jsonb_build_array(1,'a',h))::text,'UTF8')),'hex');
update publication_shadow.editions set status='approved',approved_at=now(),approved_by='test',content_hash=edition_hash where id=e;
begin insert into publication_shadow.entries values(e,'b',2,'{}',h); raise exception 'Expected rejection: append'; exception when check_violation then null; end;
begin update publication_shadow.entries set ordinal=2 where edition_id=e; raise exception 'Expected rejection: edit'; exception when check_violation then null; end;
begin update publication_shadow.entries set edition_id=other where edition_id=e; raise exception 'Expected rejection: move'; exception when check_violation then null; end;
begin delete from publication_shadow.entries where edition_id=e; raise exception 'Expected rejection: delete'; exception when check_violation then null; end;
begin update publication_shadow.editions set approved_by='changed' where id=e; raise exception 'Expected rejection: metadata'; exception when check_violation then null; end;
begin update publication_shadow.editions set status='draft' where id=e; raise exception 'Expected rejection: reverse'; exception when check_violation then null; end;
begin update publication_shadow.editions set status='published',published_at=now() where id=e; raise exception 'Expected rejection: skip'; exception when check_violation then null; end;
update publication_shadow.editions set status='frozen',frozen_at=now() where id=e;
update publication_shadow.editions set status='published',published_at=now() where id=e;
insert into publication_shadow.outbox(edition_id,channel,idempotency_key) values(e,'website','test') returning id into event;
insert into publication_shadow.delivery_receipts(event_id,provider,provider_message_id,delivery_state) values(event,'test','test','confirmed');
begin insert into publication_shadow.outbox(edition_id,channel,idempotency_key) values(e,'website','test2'); raise exception 'Expected rejection: event'; exception when unique_violation then null; end;
begin insert into publication_shadow.delivery_receipts(event_id,provider,provider_message_id,delivery_state) values(event,'test','test','confirmed'); raise exception 'Expected rejection: receipt'; exception when unique_violation then null; end;
foreach browser_role in array array['anon','authenticated'] loop
  execute format('set local role %I',browser_role);
  begin perform 1 from publication_shadow.editions; raise exception 'Expected rejection: read'; exception when insufficient_privilege then null; end;
  begin insert into publication_shadow.editions(edition_date,version) values(current_date,1); raise exception 'Expected rejection: write'; exception when insufficient_privilege then null; end;
  reset role;
end loop;
end $test$;
rollback;
select 'shadow behavior tests passed' as result;
