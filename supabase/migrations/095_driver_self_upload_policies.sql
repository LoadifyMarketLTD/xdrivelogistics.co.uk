-- Migration 095: Allow drivers to self-upload compliance documents
-- Adds:
--   1. Storage policy: drivers can INSERT into driver-docs/{company_id}/{driver_id}/...
--   2. Storage policy: drivers can DELETE their own files in driver-docs
--   3. Table policy: drivers can INSERT their own driver_documents rows
-- Path convention: driver-docs/{company_id}/{driver_id}/{filename}

-- =========================================================================
-- 1. Storage: drivers can upload their own documents
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'driver_docs_insert_own'
  ) then
    create policy "driver_docs_insert_own"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'driver-docs'
      and (storage.foldername(name))[2] = (
        select id::text from public.drivers where user_id = auth.uid() and app_access = true limit 1
      )
    );
  end if;
end $$;

-- =========================================================================
-- 2. Storage: drivers can delete their own documents
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'driver_docs_delete_own'
  ) then
    create policy "driver_docs_delete_own"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'driver-docs'
      and (storage.foldername(name))[2] = (
        select id::text from public.drivers where user_id = auth.uid() and app_access = true limit 1
      )
    );
  end if;
end $$;

-- =========================================================================
-- 3. Table: drivers can INSERT their own driver_documents rows
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_documents'
    and policyname = 'driver_docs_insert_own'
  ) then
    create policy "driver_docs_insert_own"
    on public.driver_documents for insert
    to authenticated
    with check (
      driver_id = (
        select id from public.drivers where user_id = auth.uid() and app_access = true limit 1
      )
    );
  end if;
end $$;

-- =========================================================================
-- 4. Table: drivers can SELECT their own driver_documents rows
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_documents'
    and policyname = 'driver_docs_select_own'
  ) then
    create policy "driver_docs_select_own"
    on public.driver_documents for select
    to authenticated
    using (
      driver_id = (
        select id from public.drivers where user_id = auth.uid() and app_access = true limit 1
      )
    );
  end if;
end $$;

-- =========================================================================
-- 5. Table: drivers can DELETE their own driver_documents rows
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_documents'
    and policyname = 'driver_docs_delete_own'
  ) then
    create policy "driver_docs_delete_own"
    on public.driver_documents for delete
    to authenticated
    using (
      driver_id = (
        select id from public.drivers where user_id = auth.uid() and app_access = true limit 1
      )
    );
  end if;
end $$;
