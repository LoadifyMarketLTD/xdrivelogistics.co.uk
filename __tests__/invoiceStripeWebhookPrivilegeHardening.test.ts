import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261018133038_invoice_stripe_event_security_definer.sql',
  'utf8',
);
const emailMigration = fs.readFileSync(
  'supabase/migrations/20261018134107_invoice_email_event_security_definer.sql',
  'utf8',
);

describe('PR680 Stripe webhook RPC privilege hardening', () => {
  it('runs the settlement RPC as its postgres owner with a fixed search_path', () => {
    expect(migration).toMatch(
      /ALTER FUNCTION public\.apply_invoice_stripe_event\(jsonb, boolean\)\s+SECURITY DEFINER\s+SET search_path = public, pg_temp;/is,
    );
  });

  it('keeps the RPC private to service_role', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.apply_invoice_stripe_event\(jsonb, boolean\)\s+FROM PUBLIC, anon, authenticated;/is,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.apply_invoice_stripe_event\(jsonb, boolean\)\s+TO service_role;/is,
    );
  });
});

describe('PR680 Resend webhook RPC privilege hardening', () => {
  it('runs the email event RPC as its postgres owner with a fixed search_path', () => {
    expect(emailMigration).toMatch(
      /ALTER FUNCTION public\.apply_invoice_email_event\(text, text, text, timestamptz, text\)\s+SECURITY DEFINER\s+SET search_path = public, pg_temp;/is,
    );
  });

  it('keeps the email event RPC private to service_role', () => {
    expect(emailMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.apply_invoice_email_event\(text, text, text, timestamptz, text\)\s+FROM PUBLIC, anon, authenticated;/is,
    );
    expect(emailMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.apply_invoice_email_event\(text, text, text, timestamptz, text\)\s+TO service_role;/is,
    );
  });
});
