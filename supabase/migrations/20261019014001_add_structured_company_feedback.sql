alter table public.reviews
  add column if not exists would_use_again boolean,
  add column if not exists delivered_promptly boolean,
  add column if not exists courteous boolean;

comment on column public.reviews.would_use_again is 'Structured post-job feedback: reviewer would use the counterparty again.';
comment on column public.reviews.delivered_promptly is 'Structured post-job feedback: booking was delivered promptly.';
comment on column public.reviews.courteous is 'Structured post-job feedback: counterparty was courteous/professional.';
