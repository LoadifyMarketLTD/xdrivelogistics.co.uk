BEGIN;

CREATE INDEX IF NOT EXISTS idx_company_member_blocks_created_by
  ON public.company_member_blocks(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_specialist_capabilities_declared_by
  ON public.company_specialist_capabilities(declared_by)
  WHERE declared_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_specialist_capabilities_reviewed_by
  ON public.company_specialist_capabilities(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

COMMIT;
