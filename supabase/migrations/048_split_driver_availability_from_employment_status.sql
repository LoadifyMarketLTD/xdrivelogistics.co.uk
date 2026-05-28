-- Separate operational availability from employment lifecycle status.
-- Keeps drivers.status for active/inactive admin lifecycle
-- and introduces drivers.availability_status for runtime dispatch visibility.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS availability_status text
  CHECK (availability_status IN ('available', 'busy', 'offline'));

UPDATE public.drivers
SET availability_status = CASE
  WHEN status IN ('available', 'busy', 'offline') THEN status
  WHEN availability_status IS NOT NULL THEN availability_status
  ELSE 'offline'
END
WHERE availability_status IS NULL
   OR status IN ('available', 'busy', 'offline');

UPDATE public.drivers
SET status = 'active'
WHERE status IN ('available', 'busy', 'offline');

ALTER TABLE public.drivers
  ALTER COLUMN availability_status SET DEFAULT 'offline';

NOTIFY pgrst, 'reload schema';
