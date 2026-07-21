-- Early schema guard for migrations and runtime code that maintain company
-- modification timestamps. Runs immediately after the initial schema.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
