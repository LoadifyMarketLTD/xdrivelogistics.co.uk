import fs from 'node:fs';
import path from 'node:path';

describe('Driver operational message contract', () => {
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

  test('keeps Driver messages separate from core job mutation', () => {
    expect(instructionRoute).toContain("event_type: 'driver_instruction_added'");
    expect(instructionRoute).toContain("visibility: 'execution'");
    expect(instructionRoute).toContain('immutable: true');
    expect(instructionRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.update\(/);
    expect(instructionRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.delete\(/);
  });

  test('allows posting-company operators to append messages on any non-terminal load', () => {
    expect(instructionRoute).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(instructionRoute).toContain('Only the posting company can add Driver messages.');
    expect(instructionRoute).toContain('terminalJobStatus(job)');
    expect(instructionRoute).not.toContain('const executionBound = Boolean(');
    expect(instructionRoute).toContain('New Driver messages can no longer be added.');
  });

  test('queues the permanent history before assignment and notifies the assigned Driver inbox when available', () => {
    expect(instructionRoute).toContain(".from('job_tracking_events')");
    expect(instructionRoute).toContain('.insert({');
    expect(instructionRoute).toContain(".from('notifications').insert({");
    expect(instructionRoute).toContain("type: 'driver_instruction'");
    expect(instructionRoute).toContain('assignedDriver: Boolean(checked.context.assignedDriverId)');
    expect(instructionRoute).toContain('driverInboxNotified');
    expect(instructionPanel).toContain('will be shown when a Driver is assigned');
  });

  test('exposes posting-company Driver messages in Customer and Broker workspaces', () => {
    expect(customerJobPage).toContain('DriverInstructionPanel');
    expect(customerJobPage).toContain('<DriverInstructionPanel jobId={job.id} />');
    expect(brokerJobsPage).toContain('DriverInstructionPanel');
    expect(brokerJobsPage).toContain('<DriverInstructionPanel jobId={job.id} />');
    expect(instructionPanel).toContain('Messages / changes for Driver');
    expect(instructionPanel).toContain('The original load record is not edited');
    expect(instructionPanel).toContain('Send message to Driver');
    expect(instructionPanel).toContain('response.status === 403 || response.status === 404');
  });

  test('projects message history into the assigned Driver job detail', () => {
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
