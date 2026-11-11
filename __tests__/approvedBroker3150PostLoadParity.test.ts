import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const form = source('app/components/workspace/LoadPostingForm.tsx');
const css = source('app/components/workspace/approved-post-load-3150.css');

describe('approved Broker 3150 Post Load in authorised live workspaces', () => {
  it('shares the production posting surface across Customer, Broker, Company and Owner Driver', () => {
    expect(source('app/admin/post-load/page.tsx')).toContain('<LoadPostingForm mode="admin" />');
    expect(source('app/broker/post-load/page.tsx')).toContain('<LoadPostingForm mode="broker" />');
    expect(source('app/customer/CustomerWorkspaceModules.tsx')).toContain('<LoadPostingForm mode="customer"/>');
    expect(source('app/driver/post-load/page.tsx')).toContain('<LoadPostingForm mode="owner" />');
    expect(form).toContain('xdrive-approved-postload-3150');
    expect(form).toContain("import './approved-post-load-3150.css'");
  });
  it('keeps approved Broker section order and selectable canonical load modes', () => {
    expect(form).toContain('approved-postload-modes');
    expect(form).toContain('aria-pressed={form.loadType === option.value}');
    expect(form).toContain('order: 3 }} title="Customer"');
    expect(form).toContain('order: 4 }} title="Collection and delivery"');
    expect(form).toContain('order: 5 }} title="Cargo and vehicle"');
    expect(form).toContain('approved-postload-customer-extras');
    expect(form).toContain('Hard copy POD required');
    expect(form).toContain('Pickup Details');
    expect(form).toContain('Delivery Details');
    expect(form).toContain('order: 7 }} title="Documents, access & service requirements"');
    expect(css).toContain('.xdrive-approved-postload-3150');
    expect(css).toContain('#e3f1fc');
  });
  it('keeps protected real API posting, documents, Stripe and validation instead of demo actions', () => {
    expect(form).toContain("fetch('/api/jobs/create'");
    expect(form).toContain('post-load-form');
    expect(form).toContain('StripeSetupAction');
    expect(form).toContain('WorkspaceRestrictionBanner');
    expect(form).toContain('PostcodeAddressField');
    expect(form).toContain('void save(true)');
    expect(form).toContain('void save(false)');
    expect(form).not.toContain('publishDemoLoad');
    expect(form).not.toContain('Demo Retail Distribution Ltd');
    expect(form).not.toContain('Publish Demo Load');
  });
  it('preserves dispatcher permissions and forbids Company Driver posting', () => {
    const policy = source('lib/roleCapabilities.ts');
    expect(policy).toContain("'dispatcher'");
    expect(policy).toContain("{ prefix: '/admin/post-load'");
    expect(policy).toContain("{ prefix: '/driver/post-load', workspace: 'owner_operator', roles: ['owner_driver'] }");
  });
});
