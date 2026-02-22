-- Invoices table for Danny Courier admin portal
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  invoice_number text NOT NULL,
  job_ref text NOT NULL,
  date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  client_name text NOT NULL,
  client_address text,
  client_email text,
  pickup_location text,
  pickup_datetime text,
  delivery_location text,
  delivery_datetime text,
  delivery_recipient text,
  service_description text,
  amount numeric NOT NULL DEFAULT 0,
  payment_terms text NOT NULL DEFAULT '14 days',
  late_fee text,
  vat_rate int NOT NULL DEFAULT 20,
  net_amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  pod_photos text[],
  signature text,
  recipient_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Policy: members of the same company can manage invoices
CREATE POLICY "Company members can manage invoices"
  ON public.invoices
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
