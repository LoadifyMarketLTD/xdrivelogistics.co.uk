-- Migration 130: Add pod-docs and job-docs storage buckets
-- pod-docs: POD photos uploaded via admin diary, web mobile PWA, and native mobile app
-- job-docs: General load documents uploaded via admin diary
--
-- Path conventions:
--   pod-docs: {job_id}/{timestamp}-{filename}
--   job-docs: {job_id}/{timestamp}-{filename}

-- =========================================================================
-- 1. Buckets
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pod-docs', 'pod-docs', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('job-docs', 'job-docs', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- =========================================================================
-- 2. pod-docs policies
-- Drivers upload; admins and customers can read (customer scoping
-- is enforced at the query layer — jobs.company_id = customer's company).
-- =========================================================================

-- Admin / owner / company can insert POD photos
create policy "pod_docs_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pod-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- Active drivers can insert POD photos
create policy "pod_docs_insert_driver"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pod-docs'
  and exists (
    select 1 from drivers
    where user_id = auth.uid()
    and app_access = true
  )
);

-- Admin / owner / company can read all POD photos
create policy "pod_docs_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- Active drivers can read POD photos
create policy "pod_docs_select_driver"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod-docs'
  and exists (
    select 1 from drivers
    where user_id = auth.uid()
    and app_access = true
  )
);

-- Customers can read POD photos (job-level scoping enforced by app layer)
create policy "pod_docs_select_customer"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) = 'customer'
);

-- Admin / owner / company can delete POD photos
create policy "pod_docs_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pod-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

-- =========================================================================
-- 3. job-docs policies
-- Only admin / owner / company users manage load documents.
-- =========================================================================

create policy "job_docs_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'job-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

create policy "job_docs_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'job-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);

create policy "job_docs_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'job-docs'
  and (
    select role from profiles where user_id = auth.uid() limit 1
  ) in ('owner', 'admin', 'company')
);
