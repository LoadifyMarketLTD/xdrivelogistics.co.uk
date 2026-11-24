-- Eliminate the global five-minute delay between quotes to different jobs.
-- Preserve existing duplicate-per-job, eligibility, bid-cap, and commercial guards.
-- Both legacy INSERT triggers consult this setting; zero disables their cooldown.
INSERT INTO public.platform_settings (key, label, value, value_type, category)
VALUES ('min_bid_interval_minutes', 'Min Bid Interval (minutes)', '0', 'number', 'Marketplace Rules')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
