import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeDbError } from '../app/api/_lib/errorSanitizer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test.describe('invoice authorization hardening contract', () => {
  test('sanitizes raw database errors', () => {
    expect(sanitizeDbError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe('Duplicate record.');
    expect(sanitizeDbError({ code: '42703', message: 'column delivery_state does not exist' })).toBe('Internal data error.');
    expect(sanitizeDbError({ code: 'P0001', message: 'Overpayment rejected for invoice' })).toBe(
      'Payment amount exceeds the outstanding invoice balance.'
    );
    expect(sanitizeDbError({ code: 'XX000', message: 'relation invoices does not exist' })).toBe('An internal error occurred.');
  });

  test('invoice mutation endpoints reject patch and delete explicitly', () => {
    const routeSource = fs.readFileSync(
      path.join(repoRoot, 'app/api/driver/finance/invoices/[id]/route.ts'),
      'utf8'
    );

    expect(routeSource).toContain("export async function PATCH()");
    expect(routeSource).toContain("Invoices cannot be modified after creation.");
    expect(routeSource).toContain("export async function DELETE()");
    expect(routeSource).toContain("Invoices cannot be deleted.");
  });
});
