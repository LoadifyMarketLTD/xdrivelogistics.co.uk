import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('retired mobile source trees contract', () => {
  it('does not treat removed Kotlin android-native or Expo driver trees as current repository source', () => {
    expect(existsSync('android-native')).toBe(false);
    expect(existsSync('apps/driver-mobile')).toBe(false);
  });
});
