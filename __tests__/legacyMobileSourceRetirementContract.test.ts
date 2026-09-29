import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('retired mobile source trees contract', () => {
  it('keeps removed mobile source trees out of the web repository', () => {
    expect(existsSync('android-native')).toBe(false);
    expect(existsSync('apps/driver-mobile')).toBe(false);
    expect(existsSync('app/m')).toBe(false);
  });

  it('keeps package and CI metadata free of retired mobile source commands', () => {
    const pkg = readFileSync('package.json', 'utf8');
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(pkg).not.toContain('apps/driver-mobile');
    expect(ci).not.toContain('apps/driver-mobile');
    expect(ci).not.toContain('expo-driver-typecheck');
  });
});
