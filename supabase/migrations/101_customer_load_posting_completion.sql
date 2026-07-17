-- Migration 101: Complete customer load posting operational data.
-- Adds structured fields for UK load posting, customer load document storage,
-- and RLS coverage for customer-uploaded load documents.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'swb_van') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'swb_van';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'mwb_van') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'mwb_van';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'lwb_van') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'lwb_van';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'xlwb_van') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'xlwb_van';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'luton_tail_lift') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'luton_tail_lift';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'curtainside_van') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'curtainside_van';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_3_5t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_3_5t';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_5t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_5t';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_12t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_12t';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_26t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_26t';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'artic_44t_curtainsider') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'artic_44t_curtainsider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'artic_44t_box_trailer') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'artic_44t_box_trailer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'artic_44t_flatbed') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'artic_44t_flatbed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'artic_44t_refrigerated') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'artic_44t_refrigerated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'artic_44t_double_deck') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'artic_44t_double_deck';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'hiab') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'hiab';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'moffett') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'moffett';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'adr_vehicle') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'adr_vehicle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'refrigerated_vehicle') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'refrigerated_vehicle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'temperature_controlled_vehicle') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'temperature_controlled_vehicle';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'parcels') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'parcels';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'machinery') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'machinery';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'retail_goods') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'retail_goods';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'mixed_freight') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'mixed_freight';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'adr_goods') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'adr_goods';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.cargo_type'::regtype AND enumlabel = 'temperature_controlled_freight') THEN
    ALTER TYPE public.cargo_type ADD VALUE 'temperature_controlled_freight';
  END IF;
END
$$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_time_slot text,
  ADD COLUMN IF NOT EXISTS delivery_time_slot text,
  ADD COLUMN IF NOT EXISTS collection_contact_name text,
  ADD COLUMN IF NOT EXISTS collection_contact_phone text,
  ADD COLUMN IF NOT EXISTS delivery_contact_name text,
  ADD COLUMN IF NOT EXISTS delivery_contact_phone text,
  ADD COLUMN IF NOT EXISTS customer_reference text,
  ADD COLUMN IF NOT EXISTS purchase_order_number text,
  ADD COLUMN IF NOT EXISTS booking_reference text,
  ADD COLUMN IF NOT EXISTS requested_vehicle_label text,
  ADD COLUMN IF NOT EXISTS requested_cargo_label text,
  ADD COLUMN IF NOT EXISTS cargo_value_gbp numeric(12, 2),
  ADD COLUMN IF NOT EXISTS pallet_type text,
  ADD COLUMN IF NOT EXISTS pallet_stackable boolean,
  ADD COLUMN IF NOT EXISTS collection_forklift_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_tail_lift_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_handball_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_forklift_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_tail_lift_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_handball_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_checklist text[];

ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS uploaded_by_role text;

CREATE INDEX IF NOT EXISTS idx_jobs_customer_reference ON public.jobs (customer_reference);
CREATE INDEX IF NOT EXISTS idx_jobs_booking_reference ON public.jobs (booking_reference);
CREATE INDEX IF NOT EXISTS idx_job_documents_company_id ON public.job_documents (company_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'load-documents',
  'load-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "load_documents_insert_creator_or_operator" ON storage.objects;
DROP POLICY IF EXISTS "load_documents_select_creator_operator_or_driver" ON storage.objects;
DROP POLICY IF EXISTS "load_documents_delete_creator_or_admin" ON storage.objects;

CREATE POLICY "load_documents_insert_creator_or_operator"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'load-documents'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[2]
        AND j.company_id::text = (storage.foldername(name))[1]
        AND (
          j.created_by = auth.uid()
          OR public.is_company_operator(j.company_id)
        )
    )
  );

CREATE POLICY "load_documents_select_creator_operator_or_driver"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'load-documents'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
      WHERE j.id::text = (storage.foldername(name))[2]
        AND j.company_id::text = (storage.foldername(name))[1]
        AND (
          j.created_by = auth.uid()
          OR public.is_company_non_driver(j.company_id)
          OR d.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "load_documents_delete_creator_or_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'load-documents'
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[2]
        AND j.company_id::text = (storage.foldername(name))[1]
        AND (
          j.created_by = auth.uid()
          OR public.is_company_admin(j.company_id)
        )
    )
  );

DROP POLICY IF EXISTS "job_documents_insert_creator_or_operator" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_select_creator_operator_or_driver" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_delete_creator_or_admin" ON public.job_documents;

CREATE POLICY "job_documents_insert_creator_or_operator"
  ON public.job_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_documents.job_id
        AND (
          j.created_by = auth.uid()
          OR public.is_company_operator(j.company_id)
        )
    )
    AND (uploaded_by = auth.uid() OR uploaded_by IS NULL)
  );

CREATE POLICY "job_documents_select_creator_operator_or_driver"
  ON public.job_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
      WHERE j.id = job_documents.job_id
        AND (
          j.created_by = auth.uid()
          OR public.is_company_non_driver(j.company_id)
          OR d.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "job_documents_delete_creator_or_admin"
  ON public.job_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_documents.job_id
        AND (
          j.created_by = auth.uid()
          OR public.is_company_admin(j.company_id)
        )
    )
  );
