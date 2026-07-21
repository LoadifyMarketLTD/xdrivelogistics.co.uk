-- Generic audit entries may record a state transition without pretending that
-- one of the operational milestones occurred. Keep the specific lifecycle
-- events and add this compatibility value for server-side status audit records.
ALTER TYPE public.tracking_event_type
  ADD VALUE IF NOT EXISTS 'status_change';
