-- Separate operational availability from employment lifecycle status.
-- Keeps drivers.status for active/inactive admin lifecycle
-- and introduces drivers.availability_status for runtime dispatch visibility.
--
-- Clean replay now reconstructs the hosted status_enum from migration 001.
-- Historical hosted databases may still reach this migration with drivers.status
-- as text and legacy availability labels. Cast to text only while extracting
-- those labels so the migration remains valid for both physical shapes without
-- widening the canonical lifecycle enum.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS availability_status text
  CHECK (availability_status IN ('available', 'busy', 'offline'));

UPDATE public.drivers
SET availability_status = CASE
  WHEN status::text IN ('available', 'busy', 'offline') THEN status::text
  WHEN availability_status IS NOT NULL THEN availability_status
  ELSE 'offline'
END
WHERE availability_status IS NULL
   OR status::text IN ('available', 'busy', 'offline');

UPDATE public.drivers
SET status = 'active'
WHERE status::text IN ('available', 'busy', 'offline');

ALTER TABLE public.drivers
  ALTER COLUMN availability_status SET DEFAULT 'offline';

NOTIFY pgrst, 'reload schema';