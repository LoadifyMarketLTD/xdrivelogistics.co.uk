import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const createApi = fs.readFileSync(path.join(root, 'app/api/jobs/create/route.ts'), 'utf8');
const source = `${form}\n${createApi}`;

const requiredOperationalConcepts = [
  'pickup',
  'delivery',
  'collectionContactName',
  'collectionContactPhone',
  'deliveryContactName',
  'deliveryContactPhone',
  'customerReference',
  'purchaseOrder',
  'vehicle',
  'cargo',
  'weight',
  'pallet',
  'tailLift',
  'forklift',
  'handball',
  'pod',
  'publicQuoteNotes',
  'executionInstructions',
];

describe('load posting operational contract', () => {
  it.each(requiredOperationalConcepts)('keeps %s represented by the Post Load form/API contract', (concept) => {
    expect(source.toLowerCase()).toContain(concept.toLowerCase());
  });

  it('keeps public quote notes distinct from private execution instructions', () => {
    expect(source).toContain('publicQuoteNotes');
    expect(source).toContain('executionInstructions');
    expect(source.indexOf('publicQuoteNotes')).not.toBe(source.indexOf('executionInstructions'));
  });
});
