import { describe, expect, it } from 'vitest';
import { financeCsvCell } from '../lib/finance/safeFinanceCsv';

describe('Finance CSV export spreadsheet safety', () => {
  it('escapes spreadsheet formula values even when preceded by whitespace', () => {
    expect(financeCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(financeCsvCell('  @SUM(A1:A2)')).toBe('"\'  @SUM(A1:A2)"');
    expect(financeCsvCell('\t+cmd')).toBe('"\'\t+cmd"');
    expect(financeCsvCell('-HYPERLINK("unsafe")')).toBe('"\'-HYPERLINK(""unsafe"")"');
  });
  it('preserves valid financial numbers and correctly quotes embedded text', () => {
    expect(financeCsvCell(-12.5)).toBe('"-12.5"');
    expect(financeCsvCell('150.75')).toBe('"150.75"');
    expect(financeCsvCell('ACME, "North"')).toBe('"ACME, ""North"""');
    expect(financeCsvCell(null)).toBe('""');
  });
});
