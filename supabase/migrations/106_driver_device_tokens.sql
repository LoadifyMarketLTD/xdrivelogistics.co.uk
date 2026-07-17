-- Migration 106: Add device_token column to drivers table
-- The mobile app registers FCM/Expo push tokens via
-- /api/driver/mobile/device-token, which writes device_token to the
-- drivers table. This column must exist for push notification delivery.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS device_token text;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
