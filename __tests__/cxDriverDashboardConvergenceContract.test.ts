import fs from 'node:fs';
import path from 'node:path';

describe('Driver CX convergence contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-dashboard-reference.css'), 'utf8');
  const closeCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-dashboard-cx-close.css'), 'utf8');
  const layout = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');

  it('keeps current execution and the canonical next action as the primary driver workflow', () => {
    expect(page).toContain('<span>Current execution</span>');
    expect(page).toContain('<strong>Next action:</strong>');
    expect(page).toContain('NEXT_DRIVER_ACTIONS');
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
  });

  it('places execution in the primary desktop column and driver context in the secondary rail', () => {
    expect(css).toContain('grid-template-areas: "execution context";');
    expect(css).toMatch(/\.driver-dashboard-left\s*\{[\s\S]*?grid-area:\s*context;/);
    expect(css).toMatch(/\.driver-dashboard-main\s*\{[\s\S]*?grid-area:\s*execution;/);
    expect(css).toContain('border-left: 3px solid var(--ws-blue, #1d57d8);');
  });

  it('moves desktop composition closer to CX density without replacing the XDrive execution-first contract', () => {
    expect(layout).toContain("import './driver-dashboard-cx-close.css';");
    expect(closeCss).toContain('grid-template-columns: minmax(0, 2.15fr) minmax(320px, 1fr);');
    expect(closeCss).toContain('nth-child(n + 4)');
    expect(closeCss).toContain('Latest Feedback');
    expect(closeCss).toContain('My Documents / compliance');
    expect(closeCss).not.toContain('border-radius: 8px');
    expect(closeCss).not.toContain('box-shadow');
  });

  it('does not rewrite lifecycle authority or move desktop density into Expo mobile', () => {
    expect(page).toContain("nextDriverExecutionStatus(currentStatus)");
    expect(page).toContain("p_next_status: nextStatus");
    expect(css).toContain('@media (max-width: 768px)');
    expect(page).not.toContain('apps/driver-mobile');
  });

  it('preserves truthful driver context and server-side eligibility wording', () => {
    expect(page).toContain('Vehicle identity only; full operational eligibility is revalidated server-side for quoting and allocation.');
    expect(page).toContain('Document status unavailable');
  });
});
