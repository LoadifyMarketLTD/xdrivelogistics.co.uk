import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('global postcode area autodetect contract', () => {
  const resolver = read('app/components/workspace/OperationalPostcodeAreaResolver.tsx');
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const api = read('app/api/location/postcode-area/route.ts');

  it('mounts one resolver in the shared operational shell', () => {
    expect(shell).toContain("import OperationalPostcodeAreaResolver from './OperationalPostcodeAreaResolver'");
    expect(shell).toContain('<OperationalPostcodeAreaResolver />');
  });

  it('detects postcode and outcode fields by semantic UI context', () => {
    expect(resolver).toContain("context.includes('postcode') || context.includes('outcode')");
    expect(resolver).toContain("['text', 'search'].includes(type)");
    expect(resolver).toContain("input.dataset.postcodeLookup === 'off'");
  });

  it('resolves dynamically mounted and edited postcode fields', () => {
    expect(resolver).toContain("document.addEventListener('input'");
    expect(resolver).toContain("document.addEventListener('change'");
    expect(resolver).toContain('new MutationObserver');
    expect(resolver).toContain('/api/location/postcode-area?q=');
  });

  it('supports both full UK postcodes and outcodes server-side', () => {
    expect(api).toContain("kind: fullPostcode ? 'postcode' as const : 'outcode' as const");
    expect(api).toContain('api.postcodes.io/postcodes/');
    expect(api).toContain('api.postcodes.io/outcodes/');
    expect(api).toContain('admin_district');
    expect(api).toContain('region');
    expect(api).toContain('country');
  });
});
