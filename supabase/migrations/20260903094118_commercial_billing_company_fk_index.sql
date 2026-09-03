CREATE INDEX IF NOT EXISTS platform_membership_subscriptions_company_idx
ON public.platform_membership_subscriptions(company_id)
WHERE company_id IS NOT NULL;
