import { describe, expect, it } from 'vitest';
import { buildLegacyJobSpecialRequirements, getJobClientFields } from '../lib/jobClientFields';

describe('getJobClientFields runtime hardening', () => {
  it('returns Unknown when client_name is missing', () => {
    expect(getJobClientFields({}).name).toBe('Unknown');
  });

  it('never uses load_details JSON as client name', () => {
    const fields = getJobClientFields({
      client_name: null,
      load_details: '{"source":"customer_workspace_v2","targetCarrierCost":null}',
    });
    expect(fields.name).toBe('Unknown');
  });

  it('does not throw on malformed runtime values', () => {
    expect(() => getJobClientFields({
      client_name: { bad: true } as unknown as string,
      client_email: ['a@example.com'] as unknown as string,
      client_phone: 12345 as unknown as string,
      special_requirements: { split: false } as unknown as string,
    })).not.toThrow();
  });

  it('normalizes object/array/null/undefined to safe strings', () => {
    const fields = getJobClientFields({
      client_name: ['bad'] as unknown as string,
      client_email: { bad: true } as unknown as string,
      client_phone: null,
      special_requirements: undefined,
    });
    expect(fields).toEqual({
      name: 'Unknown',
      email: '',
      phone: '',
      cargoNotes: '',
    });
  });

  it('preserves valid client data and legacy notes parsing', () => {
    const fields = getJobClientFields({
      client_name: '  ACME Logistics  ',
      client_email: '',
      client_phone: '',
      special_requirements: ' +44 7000 000000 | ops@acme.com | Fragile goods ',
    });

    expect(fields).toEqual({
      name: 'ACME Logistics',
      email: 'ops@acme.com',
      phone: '+44 7000 000000',
      cargoNotes: 'Fragile goods',
    });
  });
});

describe('buildLegacyJobSpecialRequirements', () => {
  it('ignores malformed runtime inputs without throwing', () => {
    expect(() => buildLegacyJobSpecialRequirements({
      clientEmail: { bad: true },
      clientPhone: ['x'],
      cargoNotes: null,
    })).not.toThrow();

    expect(buildLegacyJobSpecialRequirements({
      clientEmail: { bad: true },
      clientPhone: ['x'],
      cargoNotes: null,
    })).toBe('');
  });
});
