import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const supportApi = source('app/api/super-admin/support/route.ts');
const inspectorApi = source('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');
const inspectorPage = source('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');
const tickets = source('app/super-admin/support/tickets/page.tsx');
const complaints = source('app/super-admin/support/complaints/page.tsx');
const disputes = source('app/super-admin/support/disputes/page.tsx');
const health = source('app/super-admin/health/page.tsx');
const roles = source('app/super-admin/settings/roles-permissions/page.tsx');
const globalSettings = source('app/super-admin/settings/global/page.tsx');
const featureFlags = source('app/super-admin/settings/feature-flags/page.tsx');
const audit = source('app/super-admin/settings/audit-logs/page.tsx');
const notifications = source('app/super-admin/notifications/_lib/notificationsPage.tsx');

describe('Super Admin Platform Support Inspector v3', () => {
  it('preserves owner-only audited support-ticket mutation', () => {
    expect(supportApi).toContain('verifyPlatformOwner');
    expect(supportApi).toContain('owner_update_support_ticket_with_audit');
    expect(supportApi).toContain('company_id: row.company_id');
  });
  it('connects support ledgers to canonical entity inspection', () => {
    expect(tickets).toContain('PlatformEntityLink');
    expect(complaints).toContain('entityType="company"');
    expect(disputes).toContain('entityType="dispute"');
    expect(disputes).toContain('entityType="invoice"');
  });

  it('resolves both job and invoice disputes in the read-only inspector', () => {
    expect(inspectorApi).toContain("from('job_disputes')");
    expect(inspectorApi).toContain("from('invoice_disputes')");
    expect(inspectorApi).toContain("title: 'Invoice dispute state'");
    expect(inspectorPage).toContain('READ ONLY');
    expect(inspectorApi).toContain('export async function GET');
    expect(inspectorApi).not.toContain('export async function PATCH');
    expect(inspectorApi).not.toContain('export async function POST');
  });

  it('uses enterprise primitives for Platform Health and access/settings surfaces', () => {
    for (const page of [health, roles, globalSettings, featureFlags]) {
      expect(page).toContain('SuperAdminPage');
      expect(page).toContain('SuperAdminPageHeader');
    }
    expect(roles).toContain('CANONICAL_ROLES');
    expect(roles).not.toContain('role.emoji');
  });
  it('keeps Platform Health wired to verified live sources', () => {
    expect(health).toContain('/api/super-admin/health');
    expect(health).toContain('/api/super-admin/email-readiness');
    expect(health).toContain('Membership Billing');
    expect(health).toContain('Stripe Webhook Processing');
  });

  it('keeps audit and notifications professional without legacy page icons', () => {
    expect(audit).toContain('PlatformEntityLink');
    expect(audit).not.toContain('✅ Approved');
    expect(notifications).toContain("icon:'notifications'");
  });

  it('preserves governed settings endpoints instead of adding parallel mutations', () => {
    expect(globalSettings).toContain("'/api/super-admin/settings'");
    expect(globalSettings).toContain("method: 'PATCH'");
    expect(featureFlags).toContain("section: 'feature-flags'");
    expect(featureFlags).toContain("method: 'PATCH'");
  });
});
