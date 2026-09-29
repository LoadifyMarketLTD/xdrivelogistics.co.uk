import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildControlledLegalDocument, CONTROLLED_LEGAL_VERSION } from '../lib/legal/controlledLegalDocuments';
import { REGISTRATION_LEGAL_CONFIG } from '../lib/legal/registrationAgreements';
import { ROLE_TRADING_TERMS } from '../lib/legal/roleTradingTerms';

const routes = [
  ['customer_shipper_terms','app/legal/customer-shipper-terms/page.tsx'],
  ['broker_terms','app/legal/broker-terms/page.tsx'],
  ['owner_driver_terms','app/legal/owner-driver-terms/page.tsx'],
  ['carrier_fleet_terms','app/legal/carrier-fleet-terms/page.tsx'],
] as const;

describe('role-specific legal documents',()=>{
  it('defines four distinct public documents with dedicated routes',()=>{
    const hrefs = routes.map(([code])=>ROLE_TRADING_TERMS[code].href);
    expect(new Set(hrefs).size).toBe(4);
    expect(hrefs.every((href)=>href.startsWith('/legal/') && href !== '/terms')).toBe(true);
    expect(routes.every(([code])=>ROLE_TRADING_TERMS[code].version === CONTROLLED_LEGAL_VERSION)).toBe(true);
  });

  it('maps each registration role to its dedicated role-specific document',()=>{
    const expectations = [
      ['customer_shipper','customer_shipper_terms'],
      ['transport_broker','broker_terms'],
      ['owner_operator','owner_driver_terms'],
      ['fleet_operator','carrier_fleet_terms'],
    ] as const;
    for (const [role,code] of expectations) {
      const agreement = REGISTRATION_LEGAL_CONFIG[role].agreements.find((item)=>item.code===code);
      expect(agreement?.href).toBe(ROLE_TRADING_TERMS[code].href);
      expect(agreement?.version).toBe(ROLE_TRADING_TERMS[code].version);
      expect(agreement?.href).not.toBe('/terms');
    }
  });

  it('keeps the signed canonical documents materially role-specific',()=>{
    const customer = buildControlledLegalDocument('customer_shipper_terms','en');
    const broker = buildControlledLegalDocument('broker_terms','en');
    const ownerDriver = buildControlledLegalDocument('owner_driver_terms','en');
    const fleet = buildControlledLegalDocument('carrier_fleet_terms','en');
    expect(customer.sections.some((section)=>section.body.includes('3 active transport commitments') && section.body.includes('£2,500'))).toBe(true);
    expect(customer.sections.some((section)=>section.body.includes('Each time a transport buyer awards a quote'))).toBe(true);
    expect(broker.sections.some((section)=>section.body.includes('broker') && section.body.includes('carrier payment obligation'))).toBe(true);
    expect(ownerDriver.sections.some((section)=>section.body.includes('at least one collection photograph') && section.body.includes('up to 10'))).toBe(true);
    expect(fleet.sections.some((section)=>section.body.includes('Subcontracting'))).toBe(true);
  });

  it('ships a route page for every role-specific document',()=>{
    for (const [code,file] of routes) {
      const source=readFileSync(join(process.cwd(),file),'utf8');
      expect(source).toContain(`code="${code}"`);
      expect(source).toContain('ControlledLegalDocumentPage');
    }
  });

  it('exposes every role-specific document from the Legal Centre',()=>{
    const source=readFileSync(join(process.cwd(),'app/legal/page.tsx'),'utf8');
    for (const [code] of routes) expect(source).toContain(ROLE_TRADING_TERMS[code].href);
  });
});
