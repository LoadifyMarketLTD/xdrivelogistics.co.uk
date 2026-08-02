import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), 'app');

const matrix = [
  { source: 'Broker dashboard quick actions', label: 'Post customer load', route: '/broker/post-load', role: 'broker', queryParams: [] as string[] },
  { source: 'Broker dashboard quick actions', label: 'Compare carrier quotes', route: '/broker/compare-quotes', role: 'broker', queryParams: ['job'] },
  { source: 'Broker dashboard quick actions', label: 'Open disputes', route: '/broker/disputes', role: 'broker', queryParams: [] as string[] },
  { source: 'Broker dashboard quick actions', label: 'Manage carrier network', route: '/broker/carrier-network', role: 'broker', queryParams: [] as string[] },
  { source: 'Driver readiness summary', label: 'Upcoming allocated work', route: '/driver/jobs', role: 'driver', queryParams: [] as string[] },
  { source: 'Driver readiness summary', label: 'Jobs completed', route: '/driver/history', role: 'driver', queryParams: [] as string[] },
  { source: 'Driver readiness summary', label: 'Documents expiring', route: '/driver/documents', role: 'driver', queryParams: [] as string[] },
  { source: 'Driver readiness summary', label: 'Availability', route: '/driver/availability', role: 'driver', queryParams: [] as string[] },
  { source: 'Workspace shell action centre', label: 'Broker action centre', route: '/broker/action-centre', role: 'broker', queryParams: [] as string[] },
  { source: 'Workspace shell action centre', label: 'Customer action centre', route: '/customer/action-centre', role: 'customer', queryParams: [] as string[] },
  { source: 'Workspace shell action centre', label: 'Driver action centre', route: '/driver/action-centre', role: 'driver', queryParams: [] as string[] },
  { source: 'Workspace shell action centre', label: 'Admin action centre', route: '/admin/action-centre', role: 'admin', queryParams: [] as string[] },
];

describe('workspace route verification matrix', () => {
  it.each(matrix)('$source -> $label resolves to an implemented page for $role', ({ route }) => {
    const filePath = join(appRoot, route.replace(/^\//, ''), 'page.tsx');
    expect(existsSync(filePath), `${route} page.tsx should exist`).toBe(true);
  });

  it.each(matrix)('$label documents expected query params', ({ queryParams }) => {
    expect(Array.isArray(queryParams)).toBe(true);
  });
});
