import fs from 'node:fs';
import path from 'node:path';

describe('Driver operational instructions contract', () => {
  const instructionRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/workspace/jobs/[jobId]/instructions/route.ts'),
    'utf8',
  );
  const instructionPanel = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/DriverInstructionPanel.tsx'),
    'utf8',
  );
  const customerJobPage = fs.readFileSync(
    path.join(process.cwd(), 'app/customer/jobs/[id]/page.tsx'),
    'utf8',
  );
  const brokerJobsPage = fs.readFileSync(
    path.join(process.cwd(), 'app/broker/jobs/page.tsx'),
    'utf8',
  );
  const driverDetailRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/route.ts'),
    'utf8',
  );
  const driverResourcesRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'),
    'utf8',
  );
  const driverMobileApp = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/app/DriverMobileApp.tsx'),
    'utf8',
  );

  test('keeps post-award instructions separate from core job mutation', () => {
    expect(instructionRoute).toContain("event_type: 'driver_instruction_added'");
    expect(instructionRoute).toContain("visibility: 'execution'");
    expect(instructionRoute).toContain('immutable: true');
    expect(instructionRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.update\(/);
    expect(instructionRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.delete\(/);
  });

  test('allows only posting-company operators and only after execution binding', () => {
    expect(instructionRoute).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(instructionRoute).toContain('Only the posting company can add Driver instructions.');
    expect(instructionRoute).toContain('const executionBound = Boolean(');
    expect(instructionRoute).toContain('job.awarded_carrier_company_id');
    expect(instructionRoute).toContain('job.assigned_driver_id');
    expect(instructionRoute).toContain('terminalJobStatus(job)');
    expect(instructionRoute).toContain('New Driver instructions can no longer be added.');
  });

  test('appends permanent job history and notifies an assigned Driver inbox', () => {
    expect(instructionRoute).toContain(".from('job_tracking_events')");
    expect(instructionRoute).toContain('.insert({');
    expect(instructionRoute).toContain(".from('notifications').insert({");
    expect(instructionRoute).toContain("type: 'driver_instruction'");
    expect(instructionRoute).toContain('driverInboxNotified');
  });

  test('exposes the same posting-company control in Customer and Broker workspaces', () => {
    expect(customerJobPage).toContain('DriverInstructionPanel');
    expect(customerJobPage).toContain('<DriverInstructionPanel jobId={job.id} />');
    expect(brokerJobsPage).toContain('DriverInstructionPanel');
    expect(brokerJobsPage).toContain('<DriverInstructionPanel jobId={job.id} />');
    expect(instructionPanel).toContain('Append-only operational updates for the awarded Driver.');
    expect(instructionPanel).toContain('do not change the route, rate, cargo, timing, vehicle or awarded terms');
    expect(instructionPanel).toContain('Send instruction to Driver');
    expect(instructionPanel).toContain('response.status === 403 || response.status === 404');
  });

  test('projects instruction history into the assigned Driver job detail', () => {
    expect(driverDetailRoute).toContain(".eq('event_type', 'driver_instruction_added')");
    expect(driverDetailRoute).toContain('mapDriverInstructions');
    expect(driverDetailRoute).toContain('specialInstructions,');
    expect(driverDetailRoute).toContain('driverInstructionsPartial');
    expect(driverMobileApp).toContain('job.specialInstructions');
    expect(driverMobileApp).toContain('label="Special Instructions"');
  });

  test('reconciles the Driver inbox backend with the Expo alerts contract', () => {
    expect(driverResourcesRoute).toContain('const alerts = [...operationalAlerts, ...inboxAlerts]');
    expect(driverResourcesRoute).toContain("event_type: String(row.type || 'notification')");
    expect(driverResourcesRoute).toContain('payload: {');
    expect(driverResourcesRoute).toContain('alerts,');
    expect(driverResourcesRoute).toContain('notifications: inboxNotifications');
  });
});
