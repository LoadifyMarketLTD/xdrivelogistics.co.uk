import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const routes = [
  'jobs',
  'availability',
  'won-work',
  'load-alerts',
  'nearby',
  'documents',
  'finance',
  'messages',
] as const;

const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('Owner Driver More page audit contract', () => {
  it('keeps every More destination implemented as a real page', () => {
    for (const route of routes) {
      const file = path.join(ROOT, 'app', 'driver', route, 'page.tsx');
      expect(fs.existsSync(file), `/driver/${route}`).toBe(true);
      const source = fs.readFileSync(file, 'utf8').toLowerCase();
      expect(source, `/driver/${route}`).not.toContain('coming soon');
      expect(source, `/driver/${route}`).not.toContain('placeholder data');
    }
  });

  it('does not expose native buttons with no action semantics', () => {
    for (const route of routes) {
      const source = read(`app/driver/${route}/page.tsx`);
      const buttons = source.match(/<button\b[^>]*>/g) ?? [];
      const dead = buttons.filter((button) =>
        !/\bonClick\s*=/.test(button)
        && !/\bdisabled(?:\s|=|>)/.test(button)
        && !/\btype\s*=\s*["']submit["']/.test(button),
      );
      expect(dead, `/driver/${route}: ${dead.join(' | ')}`).toEqual([]);
    }
  });

  it('does not present editable form controls without change semantics', () => {
    for (const route of routes) {
      const source = read(`app/driver/${route}/page.tsx`);
      const controls = source.match(/<(?:input|select|textarea)\b[^>]*>/g) ?? [];
      const dead = controls.filter((control) =>
        !/\bonChange\s*=/.test(control)
        && !/\bonInput\s*=/.test(control)
        && !/\breadOnly(?:\s|=|>)/.test(control)
        && !/\bdisabled(?:\s|=|>)/.test(control)
        && !/\btype\s*=\s*["']hidden["']/.test(control),
      );
      expect(dead, `/driver/${route}: ${dead.join(' | ')}`).toEqual([]);
    }
  });

  it('defines Driver prototype geometry variables on the live top-workspace shell', () => {
    const css = read('app/driver/driver-prototype-parity.css');
    const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
    expect(shell).toContain("top-workspace-shell__content${driverPrototypeScope ? ' app driver-prototype-app' : ''}");
    expect(css).toContain('.xdrive-driver-workspace .top-workspace-shell__content,');
    expect(css).toContain('--driver-prototype-rail: 245px;');
    expect(css).toContain('grid-template-columns: var(--driver-prototype-rail) minmax(0, 1fr) !important;');
  });

  it('wires Availability rail/main and Nearby map/list presentation', () => {
    const availability = read('app/driver/availability/page.tsx');
    const availabilityCss = read('app/driver/availability/availability-exchange.css');
    const nearby = read('app/driver/nearby/page.tsx');
    expect(availability).toContain('className="driver-availability-board"');
    expect(availability).toContain('className="driver-availability-rail"');
    expect(availability).toContain('className="driver-availability-main"');
    expect(availabilityCss).toContain('grid-template-columns: var(--availability-rail) minmax(0, 1fr);');
    expect(nearby).toContain("const [viewMode, setViewMode] = useState<'map' | 'list'>('map');");
    expect(nearby).toContain("onClick={() => setViewMode('map')}");
    expect(nearby).toContain("onClick={() => setViewMode('list')}");
    expect(nearby).toContain('id="availMap"');
    expect(nearby).toContain('id="availList"');
    expect(nearby).not.toContain('className="avail-audience"');
  });
});
