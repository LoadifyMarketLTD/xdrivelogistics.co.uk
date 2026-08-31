begin;

-- Hosted history contains the legacy invites/company_members schema, while the
-- canonical repository replay may not. The runtime no longer calls this legacy
-- RPC. Where the legacy schema exists, keep the hardened authenticated-identity
-- binding; where it does not, do not recreate parallel legacy tables solely to
-- preserve a retired RPC.
do $migration$
begin
  if to_regclass('public.invites') is not null
     and to_regclass('public.company_members') is not null
     and to_regclass('public.profiles') is not null then
    execute $ddl$
      create or replace function public.accept_driver_invite(
        p_token text,
        p_full_name text default null::text,
        p_phone text default null::text
      )
      returns table(invite public.invites, profile public.profiles, membership public.company_members)
      language plpgsql
      security definer
      set search_path to 'public', 'pg_temp'
      as $function$
      declare
        v_uid uuid := auth.uid();
        v_auth_email text;
        v_auth_phone text;
        v_inv public.invites;
        v_prof public.profiles;
        v_mem public.company_members;
      begin
        if v_uid is null then
          raise exception 'Not authenticated' using errcode = '42501';
        end if;

        select lower(btrim(u.email)), regexp_replace(coalesce(u.phone, ''), '[^0-9]+', '', 'g')
          into v_auth_email, v_auth_phone
        from auth.users u
        where u.id = v_uid;

        select * into v_inv
        from public.invites
        where token = p_token
        for update;

        if not found then raise exception 'Invalid token' using errcode = 'P0002'; end if;
        if v_inv.status <> 'sent' then raise exception 'Invite not available' using errcode = '23514'; end if;

        if v_inv.expires_at <= now() then
          update public.invites set status='expired' where id = v_inv.id;
          raise exception 'Invite expired' using errcode = '23514';
        end if;

        if nullif(btrim(v_inv.invite_email), '') is not null
           and lower(btrim(v_inv.invite_email)) is distinct from v_auth_email then
          raise exception 'This invite belongs to a different email address.' using errcode = '42501';
        end if;

        if nullif(btrim(v_inv.invite_email), '') is null
           and nullif(btrim(v_inv.invite_phone), '') is not null then
          if nullif(v_auth_phone, '') is null
             or regexp_replace(v_inv.invite_phone, '[^0-9]+', '', 'g') is distinct from v_auth_phone then
            raise exception 'This invite belongs to a different phone number.' using errcode = '42501';
          end if;
        end if;

        insert into public.profiles(user_id, role, status, full_name, phone)
        values (v_uid, 'driver', 'active', p_full_name, p_phone)
        on conflict (user_id) do update set
          role='driver',
          status='active',
          full_name=coalesce(excluded.full_name, public.profiles.full_name),
          phone=coalesce(excluded.phone, public.profiles.phone)
        returning * into v_prof;

        insert into public.company_members(company_id, user_id, member_role)
        values (v_inv.company_id, v_uid, 'driver')
        on conflict (company_id, user_id) do update set member_role='driver'
        returning * into v_mem;

        update public.invites
        set status='accepted', used_by=v_uid, used_at=now()
        where id=v_inv.id
        returning * into v_inv;

        invite := v_inv;
        profile := v_prof;
        membership := v_mem;
        return next;
      end;
      $function$;
    $ddl$;

    execute 'revoke execute on function public.accept_driver_invite(text, text, text) from public, anon';
    execute 'grant execute on function public.accept_driver_invite(text, text, text) to authenticated, service_role';
  end if;
end;
$migration$;

commit;
