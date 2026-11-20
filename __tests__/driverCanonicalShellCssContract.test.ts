import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver canonical workspace shell CSS contract', () => {
  it('loads canonical CSS and mounts the approved layout gate behind route protection', () => {
    const layout = read('app/driver/layout.tsx');
    expect(layout).toContain("import '../components/workspace/top-workspace-shell.css';");
    expect(layout).toContain("import DriverMasterLayoutGate from './DriverMasterLayoutGate';");
    expect(layout).toMatch(/<ProtectedRoute[^>]*>[\s\S]*<DriverMasterLayoutGate>\{children\}<\/DriverMasterLayoutGate>[\s\S]*<\/ProtectedRoute>/);
  });

  it('mounts the canonical shell for Owner Driver while preserving approved Post Load', () => {
    const gate = read('app/driver/DriverMasterLayoutGate.tsx');
    expect(gate).toContain("import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';");
    expect(gate).toMatch(/if\(workspace==='owner_driver'\)\{[\s\S]*?section==='post-load'\s*\?\s*<MasterWorkspace[^>]*dashboard=\{children\}[^>]*\/>\s*:\s*<DriverTopWorkspaceShell>\{children\}<\/DriverTopWorkspaceShell>/);
    const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
    expect(shell).toContain("import TopWorkspaceShell from '../../components/workspace/TopWorkspaceShell';");
    expect(shell).toContain('<TopWorkspaceShell>{children}</TopWorkspaceShell>');
  });
});
