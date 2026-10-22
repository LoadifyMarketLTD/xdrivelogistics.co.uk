import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('cross-workspace quote lifecycle wiring', () => {
  const customer = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  const broker = read('app/broker/bids/page.tsx');
  const driver = read('app/driver/quotes/page.tsx');
  const carrier = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const lifecycle = read('app/api/workspace/bids/[id]/lifecycle/route.ts');
  const workspaceData = read('app/components/workspace/useCompanyWorkspaceData.ts');
  const migration = read('supabase/migrations/20261009111500_quote_lifecycle_metadata.sql');

  it('wires customer and broker poster views to canonical viewed/shortlisted/archive lifecycle', () => {
    for (const source of [customer, broker]) {
      expect(source).toContain('canonicalQuoteStage');
      expect(source).toContain('shortlist');
      expect(source).toContain('archive_poster');
    }
  });

  it('keeps CX-live four-tab bidder presentation while preserving terminal lifecycle actions on records', () => {
    for (const source of [driver, carrier]) {
      for (const label of ['Received', 'Archived', 'Submitted', 'Unsuccessful']) expect(source).toContain(label);
      expect(source).toContain('archive_bidder');
      for (const terminal of ['accepted', 'unsuccessful', 'withdrawn', 'expired']) expect(source).toContain(`'${terminal}'`);
      expect(source).toContain("stage === 'archived'");
    }
    expect(driver).not.toContain('Accepted / Won');
    expect(carrier).not.toContain('Accepted / Won');
  });

  it('keeps lifecycle metadata available in shared company workspace bid reads', () => {
    for (const field of ['viewed_at', 'shortlisted_at', 'poster_archived_at', 'bidder_archived_at']) {
      expect(workspaceData).toContain(field);
      expect(migration).toContain(field);
    }
  });

  it('authorizes poster and bidder lifecycle mutations server-side and audits them', () => {
    expect(lifecycle).toContain("const POSTER_ROLES = new Set(['owner', 'admin', 'dispatcher'])");
    expect(lifecycle).toContain("String(bid.bidder_user_id ?? '') === auth.user.id");
    expect(lifecycle).toContain(".from('company_memberships')");
    expect(lifecycle).toContain(".from('job_tracking_events').insert");
    expect(lifecycle).toContain("event_type: 'note'");
    expect(lifecycle).toContain('lifecycle_event: eventType');
    expect(lifecycle).toContain('quote_shortlisted');
    expect(lifecycle).toContain('quote_archived_by_bidder');
  });
});
