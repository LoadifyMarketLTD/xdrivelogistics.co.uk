import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-06 Super Admin Operations exception control', () => {
  it('derives inspector actions server-side under active Platform Owner authority', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("Forbidden: active Platform Owner required.");
    expect(route).toContain("new Set(['job', 'driver', 'vehicle', 'pod', 'dispute'])");
    expect(route).toContain('marketplaceActionsFor');
  });

  it('reuses canonical marketplace governance state rules instead of adding a second job mutation path', () => {
    const actionsRoute = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');
    const inspectorPage = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');
    const marketplaceRoute = readRepoFile('app/api/super-admin/marketplace/[id]/route.ts');

    expect(actionsRoute).toContain("normalizedStatus === 'draft' || normalizedStatus === 'posted'");
    expect(actionsRoute).toContain("['draft', 'posted', 'allocated', 'in_transit'].includes(normalizedStatus)");
    expect(inspectorPage).toContain('/api/super-admin/marketplace/${encodeURIComponent(entityIdParam)}');
    expect(marketplaceRoute).toContain("supabaseAdmin.rpc(\n    'apply_marketplace_governance_action'");
    expect(marketplaceRoute).toContain('verifyPlatformOwner(request)');
  });

  it('suppresses Case Centre mutations when the SA-02 schema is unavailable', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');

    expect(route).toContain('CASE_SCHEMA_UNAVAILABLE_CODES');
    expect(route).toContain('caseCentreAvailable = false');
    expect(route).toContain('Case-opening actions are suppressed.');
    expect(route).toContain('if (activeCases.length === 0) actions.push(...CASE_ACTIONS)');
    expect(route).toContain('An active Platform Case already exists for this entity.');
  });

  it('opens cases through the canonical Case Centre API with dedupe and provenance', () => {
    const inspectorPage = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');

    expect(inspectorPage).toContain("fetch('/api/super-admin/cases'");
    expect(inspectorPage).toContain("source: 'operations'");
    expect(inspectorPage).toContain('dedupeKey: `operations:${entityTypeParam}:${entityIdParam}`');
    expect(inspectorPage).toContain("origin: 'platform_entity_inspector'");
    expect(inspectorPage).toContain('PlatformActionPanel');
  });

  it('offers explicit P0-P3 severity choices rather than silently assigning severity', () => {
    const route = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');

    for (const severity of ['P0', 'P1', 'P2', 'P3']) {
      expect(route).toContain(`caseSeverity: '${severity}'`);
    }
  });
});
