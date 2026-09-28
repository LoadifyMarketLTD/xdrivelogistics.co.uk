BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

UPDATE public.profiles p
SET status = 'pending'::public.user_status,
    updated_at = now()
FROM public.onboarding_applications a
WHERE a.user_id = p.user_id
  AND a.account_type IN ('broker_shipper', 'fleet_courier', 'owner_driver', 'individual_driver')
  AND a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')
  AND p.status::text = 'active';

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    JOIN public.profiles p ON p.user_id = a.user_id
    WHERE a.account_type IN ('broker_shipper', 'fleet_courier', 'owner_driver', 'individual_driver')
      AND a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')
      AND p.status::text <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Governed onboarding profile gate invariant is still violated.'
      USING ERRCODE = '23514';
  END IF;
END;
$verify$;

COMMIT;
