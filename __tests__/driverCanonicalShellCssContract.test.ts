import fs from 'node:fs';
import path from 'node:path';

describe('Driver canonical workspace shell CSS contract', () => {
  it('loads the canonical TopWorkspaceShell stylesheet in the Driver layout', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');
    expect(source).toContain("import '../components/workspace/top-workspace-shell.css';");
    expect(source).toContain("import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';");
  });
});
