import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), 'app');

const matrix = [
  { source: 'Broker dashboard quick actions', label: 'Post customer load', route: '/broker/post-load', role: 'broker' },
  { source: 'Broker dashboard quick actions', label: 'Compare carrier quotes', route: '/broker/compare-quotes', role: 'broker' },
  { source: 'Broker dashboard quick actions', label: 'Open disputes', route: '/broker/disputes', role: 'broker' },
  { source: 'Broker dashboard quick actions', label: 'Manage carrier network', route: '/broker/carrier-network', role: 'broker' },
  { source: 'Driver readiness summary', label: 'Upcoming allocated work', route: '/driver/jobs', role: 'driver' },
  { source: 'Driver readiness summary', label: 'Jobs completed', route: '/driver/history', role: 'driver' },
  { source: 'Driver readiness summary', label: 'Documents expiring', route: '/driver/documents', role: 'driver' },
  { source: 'Driver readiness summary', label: 'Availability', route: '/driver/availability', role: 'driver' },
];

describe('workspace route verification matrix', () => {
  it.each(matrix)('$source -> $label resolves to an implemented page for $role', ({ route }) => {
    const filePath = join(appRoot, route.replace(/^\//, ''), 'page.tsx');
    expect(existsSync(filePath), `${route} page.tsx should exist`).toBe(true);
  });
});
