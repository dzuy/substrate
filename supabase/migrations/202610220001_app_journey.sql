-- PREPARED ONLY. Approval required before applying. No billing entitlement is created.
create table public.app_journey_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null default 0,
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.app_journey_state enable row level security;
create policy "Read own app journey" on public.app_journey_state for select to authenticated using (user_id=auth.uid());
grant select on public.app_journey_state to authenticated;
create function public.save_app_journey(expected_revision integer,new_payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if new_payload->>'version' is distinct from '1' or (new_payload->>'revision')::integer <= expected_revision or octet_length(new_payload::text)>500000 then raise exception 'Invalid journey'; end if;
 insert into app_journey_state(user_id,revision,payload) values(auth.uid(),0,'{}') on conflict do nothing;
 update app_journey_state set revision=(new_payload->>'revision')::integer,payload=new_payload,updated_at=now()
 where user_id=auth.uid() and revision=expected_revision;
 if not found then raise exception 'Journey changed; reload before saving'; end if;
end; $$;
revoke all on function public.save_app_journey(integer,jsonb) from public;
grant execute on function public.save_app_journey(integer,jsonb) to authenticated;
