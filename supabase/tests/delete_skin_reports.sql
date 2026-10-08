begin;
do $$
declare owner_id uuid; test_id uuid := gen_random_uuid();
begin
 select id into owner_id from auth.users order by created_at limit 1;
 if owner_id is null then raise exception 'Test requires an existing account'; end if;
 insert into public.skin_reports(id,user_id,payload) values(test_id,owner_id,'{"test":"delete regression"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
  perform public.permanently_delete_skin_report(test_id);
  raise exception 'Other account deletion was allowed';
 exception when others then
  if sqlerrm <> 'Report not found' then raise; end if;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 perform public.permanently_delete_skin_report(test_id);
 perform public.permanently_delete_skin_report(test_id);
 if exists(select 1 from public.skin_reports where id=test_id) then raise exception 'Report payload survived deletion'; end if;
 begin
  insert into public.skin_reports(id,user_id,payload) values(test_id,owner_id,'{}');
  raise exception 'Stale restore was allowed';
 exception when others then
  if sqlerrm <> 'Report permanently deleted' then raise; end if;
 end;
end $$;
rollback;
