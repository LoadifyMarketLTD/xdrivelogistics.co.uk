BEGIN;

WITH eligible AS (
  SELECT
    j.id AS job_id,
    COALESCE(j.delivered_at, j.pod_generated_at, j.updated_at, now()) AS evidence_time,
    NULLIF(btrim(j.client_signature_name), '') AS recipient_name,
    NULLIF(btrim(j.driver_notes), '') AS delivery_notes,
    CASE
      WHEN j.delivery_status IN ('Completed Delivery','Partial Delivery','Failed Delivery','Refused','Left Safe')
        THEN j.delivery_status
      ELSE 'Completed Delivery'
    END AS delivery_status,
    COALESCE((
      SELECT array_agg(photo)
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(COALESCE(j.delivery_photos, '[]'::jsonb)) = 'array'
          THEN COALESCE(j.delivery_photos, '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS photo
      WHERE btrim(photo) <> ''
        AND photo !~* '^data:'
    ), ARRAY[]::text[]) AS stored_photo_paths,
    d.user_id AS driver_user_id
  FROM public.jobs j
  LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
  WHERE lower(COALESCE(NULLIF(j.current_status, ''), NULLIF(j.status, ''), '')) IN ('delivered','completed','invoiced')
    AND NULLIF(btrim(COALESCE(j.client_signature_name, '')), '') IS NOT NULL
    AND j.delivery_signature_data IS NOT NULL
    AND j.delivery_signature_data <> 'null'::jsonb
    AND (
      (jsonb_typeof(COALESCE(j.delivery_photos, '[]'::jsonb)) = 'array'
       AND jsonb_array_length(COALESCE(j.delivery_photos, '[]'::jsonb)) > 0)
      OR
      (jsonb_typeof(COALESCE(j.pod_photos, '[]'::jsonb)) = 'array'
       AND jsonb_array_length(COALESCE(j.pod_photos, '[]'::jsonb)) > 0)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.proof_of_delivery p WHERE p.job_id = j.id
    )
)
INSERT INTO public.proof_of_delivery (
  job_id,
  delivered_on,
  received_by,
  delivery_status,
  delivery_notes,
  photo_urls,
  created_by,
  created_at,
  updated_at
)
SELECT
  job_id,
  evidence_time::date,
  recipient_name,
  delivery_status,
  delivery_notes,
  stored_photo_paths,
  driver_user_id,
  evidence_time,
  evidence_time
FROM eligible;

UPDATE public.jobs j
SET
  pod_generated = true,
  pod_generated_at = COALESCE(j.pod_generated_at, j.delivered_at, j.updated_at, now()),
  updated_at = j.updated_at
WHERE EXISTS (
  SELECT 1 FROM public.proof_of_delivery p WHERE p.job_id = j.id
)
AND NULLIF(btrim(COALESCE(j.client_signature_name, '')), '') IS NOT NULL
AND j.delivery_signature_data IS NOT NULL
AND j.delivery_signature_data <> 'null'::jsonb
AND (
  (jsonb_typeof(COALESCE(j.delivery_photos, '[]'::jsonb)) = 'array'
   AND jsonb_array_length(COALESCE(j.delivery_photos, '[]'::jsonb)) > 0)
  OR
  (jsonb_typeof(COALESCE(j.pod_photos, '[]'::jsonb)) = 'array'
   AND jsonb_array_length(COALESCE(j.pod_photos, '[]'::jsonb)) > 0)
)
AND j.pod_generated IS DISTINCT FROM true;

COMMIT;