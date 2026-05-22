-- Migration 032: Supabase Storage buckets for driver docs, vehicle docs, and POD photos
-- Creates buckets and RLS storage policies scoped by company + role.

-- =========================================================================
-- 1. Buckets
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('driver-docs',   'driver-docs',   false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('vehicle-docs',  'vehicle-docs',  false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('pod-photos',    'pod-photos',    false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- =========================================================================
-- 2. Helper: resolve authenticated user's company_id from profiles
-- =========================================================================

create or replace function storage.auth_company_id()
returns uuid
language sql stable security definer
as $$
  select company_id::uuid
  from profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- =========================================================================
-- 3. driver-docs policies
-- Storage path convention: driver-docs/{company_id}/{driver_id}/{filename}
-- =========================================================================

-- Admin/owner/company can upload driver documents for their company
create policy "driver_docs_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driver-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- Admin/owner/company can read driver documents for their company
create policy "driver_docs_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- Driver can read their own documents
create policy "driver_docs_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-docs'
  and (storage.foldername(name))[2] = (
    select id::text from drivers where user_id = auth.uid() and app_access = true limit 1
  )
);

-- Admin/owner/company can delete driver documents for their company
create policy "driver_docs_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'driver-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- =========================================================================
-- 4. vehicle-docs policies
-- Storage path convention: vehicle-docs/{company_id}/{vehicle_id}/{filename}
-- =========================================================================

create policy "vehicle_docs_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vehicle-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

create policy "vehicle_docs_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vehicle-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

create policy "vehicle_docs_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vehicle-docs'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- =========================================================================
-- 5. pod-photos policies
-- Storage path convention: pod-photos/{company_id}/{job_id}/{filename}
-- =========================================================================

-- Driver can upload POD photos for jobs assigned to them
create policy "pod_photos_insert_driver"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pod-photos'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and exists (
    select 1 from drivers
    where user_id = auth.uid()
    and app_access = true
    and company_id::uuid = storage.auth_company_id()
  )
);

-- Admin/owner/company can read all POD photos for their company
create policy "pod_photos_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod-photos'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- Driver can read POD photos for their own company
create policy "pod_photos_select_driver"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod-photos'
  and (storage.foldername(name))[1]::uuid = storage.auth_company_id()
  and exists (
    select 1 from drivers
    where user_id = auth.uid()
    and app_access = true
    and company_id::uuid = storage.auth_company_id()
  )
);
