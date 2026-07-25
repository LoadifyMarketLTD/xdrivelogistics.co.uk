-- Backup: auth.users metadata + profiles + onboarding_applications + drivers
-- for the 15 confirmed accounts and 7 internal accounts targeted by
-- migration 20260721221000_reconcile_confirmed_current_accounts.sql
--
-- Run this BEFORE applying migration 20260721221000.
-- Tables are created with IF NOT EXISTS — safe to re-run.
-- To restore a specific field, query the backup table and UPDATE the live table manually.

CREATE TABLE IF NOT EXISTS public.backup_20260721221000_auth_users_metadata AS
SELECT
  now()                    AS backed_up_at,
  u.id,
  lower(u.email)           AS email,
  u.raw_user_meta_data,
  u.raw_app_meta_data,
  u.updated_at
FROM auth.users u
WHERE lower(u.email) IN (
  -- 15 confirmed external accounts
  'thesbsourier@yahoo.com',
  'ajhcouriersltd@outlook.com',
  'arif52@hotmail.co.uk',
  'earlyriselogistics.erl@gmail.com',
  'maria.amariutei15@gmail.com',
  'usamaali5454@gmail.com',
  'kennykagande2@gmail.com',
  'arvinraj1515@gmail.com',
  'danielapostoae@yahoo.com',
  'mtlogisticsgroup555@gmail.com',
  'ryolimitedlogistics@outlook.com',
  'info@hszlogistics.co.uk',
  'alexa.dorobantu86@gmail.com',
  'tomm25cowper@gmail.com',
  'logistics@navson.com',
  -- 7 internal/owner accounts
  'dannyelbill@gmail.com',
  'dannyelbill447@gmail.com',
  'dannycourierltd@gmail.com',
  'angelicatoda@gmail.com',
  'fleserdumitru@gmail.com',
  'loadifymarket.co.uk@gmail.com',
  'xdrivelogisticsltd@gmail.com'
);
