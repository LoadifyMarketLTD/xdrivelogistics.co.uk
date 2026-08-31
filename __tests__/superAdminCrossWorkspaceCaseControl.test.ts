import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin cross-workspace Platform Case control', () => {
  const root = process.cwd();
  const actionRoute = fs.readFileSync(
    path.join(root, 'app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts'),
    'utf8',
  );
  const inspectorPage = fs.readFileSync(
    path.join(root, 'app/super-admin/inspect/[entityType]/[entityId]/page.tsx'),
    'utf8',
  );

  it('allows every canonical non-case inspector domain to enter the persistent case lifecycle', () => {
    for (const entityType of ['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute']) {
      expect(actionRoute).toContain(`'${entityType}'`);
    }
    expect(actionRoute).toContain('CASE_CAPABLE_ENTITY_TYPES');
    expect(actionRoute).toContain(".from('platform_cases')");
    expect(actionRoute).toContain('CASE_ACTIONS');
  });

  it('resolves company, user and support ticket authority from canonical sources', () => {
    expect(actionRoute).toContain(".from('companies')");
    expect(actionRoute).toContain(".from('profiles')");
    expect(actionRoute).toContain('auth.admin.getUserById');
    expect(actionRoute).toContain(".from('support_tickets')");
  });

  it('does not invent duplicate company or support mutation handlers in the inspector registry', () => {
    expect(actionRoute).not.toContain("set_company_status_governance");
    expect(actionRoute).not.toContain("owner_update_support_ticket_with_audit");
    expect(actionRoute).not.toContain(".update(");
    expect(actionRoute).not.toContain(".insert(");
  });

  it('creates cases only through the canonical Case Centre API with entity identity and dedupe provenance', () => {
    expect(inspectorPage).toContain("fetch('/api/super-admin/cases'");
    expect(inspectorPage).toContain('entityType: entityTypeParam');
    expect(inspectorPage).toContain('entityId: entityIdParam');
    expect(inspectorPage).toContain('dedupeKey:');
    expect(inspectorPage).toContain("origin: 'platform_entity_inspector'");
  });

  it('suppresses case-opening actions if the Case Centre schema is unavailable', () => {
    expect(actionRoute).toContain('isCaseSchemaUnavailable');
    expect(actionRoute).toContain('caseCentreAvailable = false');
    expect(actionRoute).toContain('Case-opening actions are suppressed');
  });
});
