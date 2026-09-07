import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const masterCss = source('app/super-admin/super-admin-master-contract.css');
const operationalMap = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const globalSettings = source('app/super-admin/settings/global/page.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');

const legacyColors = [
  '#F5F7FA', '#4A4A4A', '#E0E3E7', '#F4F6F8', '#D9E1EA', '#1A1F2B',
  '#0B2F6B', '#1D57D8', '#64748B', '#F5A300', '#16A34A', '#DC2626',
  '#9A5D00', '#FFF4DA', '#E5E7EB', '#94A3B8', '#FEF2F2', '#F0FDF4',
  '#EEF4FF', '#BBF7D0',
] as const;

const assertNoLegacy = (name: string, content: string) => {
  for (const value of legacyColors) expect(content, `${name} still emits ${value}`).not.toContain(value);
  expect(content, `${name} still emits 4px radius`).not.toContain("borderRadius: '4px'");
};

describe('MASTER CONTRACT FINAL v2 — residual source lock', () => {
  it('removes legacy master aliases completely', () => {
    expect(masterCss).not.toContain('--sa-master-');
    expect(masterCss).not.toContain('v1 compatibility');
  });

  it('keeps the operational map inside the exact enterprise visual system', () => {
    assertNoLegacy('operational map', operationalMap);
    for (const token of ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#8A9099', '#FFFFFF']) expect(operationalMap).toContain(token);
    expect(operationalMap).toContain("button.style.padding = '12px 18px'");
    expect(operationalMap).toContain("button.style.borderRadius = '8px'");
    expect(operationalMap).toContain("button.style.fontSize = '16px'");
    expect(operationalMap).toContain("button.style.fontWeight = '500'");
    expect(operationalMap).toContain("shadow: '0px 2px 6px rgba(0,0,0,0.08)'");
  });

  it('keeps Global Settings exact v2 instead of legacy inline styling', () => {
    assertNoLegacy('Global Settings', globalSettings);
    expect(globalSettings).toContain("padding: '24px'");
    expect(globalSettings).toContain("padding: '12px 18px'");
    expect(globalSettings).toContain("borderRadius: '8px'");
    expect(globalSettings).toContain("shadow: '0px 2px 6px rgba(0,0,0,0.08)'");
    expect(globalSettings).toContain("fontSize: '20px', fontWeight: 700");
    expect(globalSettings).toContain("fontSize: '16px'");
    expect(globalSettings).toContain('Global Settings');
  });

  it('keeps Active Companies exact v2 and canonical visible status', () => {
    assertNoLegacy('Active Companies', activeCompanies);
    expect(activeCompanies).toContain("['Company Name', 'Reg. Number', 'Email', 'Type', 'Status', 'Created']");
    expect(activeCompanies).toContain("padding: '24px'");
    expect(activeCompanies).toContain("padding: '12px 18px'");
    expect(activeCompanies).toContain("borderRadius: '8px'");
    expect(activeCompanies).toContain("shadow: '0px 2px 6px rgba(0,0,0,0.08)'");
    expect(activeCompanies).toContain('>READY</span>');
    expect(activeCompanies).not.toContain('>Active</span>');
  });
});
