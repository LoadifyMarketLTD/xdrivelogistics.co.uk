import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'), 'utf8');

describe('driver mobile alert domain separation', () => {
  it('keeps finance events out of Driver Alerts', () => {
    expect(route).toContain("const FINANCE_ALERT_ENTITY_TYPES = new Set(['invoice', 'payment', 'billing', 'subscription', 'membership'])");
    expect(route).toContain("const FINANCE_ALERT_EVENT_PREFIX = /^(invoice|payment|billing|subscription|membership|finance)_/");
    expect(route).toContain('.filter((row) => isDriverOperationalAlert(row as AnyRow))');
  });
});