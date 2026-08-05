import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveEnvironment } from '../app/api/super-admin/_lib/envDetection';

describe('resolveEnvironment (Netlify APP_ENV contract)', () => {
  const original = process.env.APP_ENV;

  beforeEach(() => {
    delete process.env.APP_ENV;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = original;
    }
  });

  it('returns PRODUCTION when APP_ENV=production', () => {
    process.env.APP_ENV = 'production';
    expect(resolveEnvironment()).toBe('PRODUCTION');
  });

  it('returns STAGING when APP_ENV=staging', () => {
    process.env.APP_ENV = 'staging';
    expect(resolveEnvironment()).toBe('STAGING');
  });

  it('returns STAGING when APP_ENV=preview', () => {
    process.env.APP_ENV = 'preview';
    expect(resolveEnvironment()).toBe('STAGING');
  });

  it('returns DEVELOPMENT when APP_ENV=development', () => {
    process.env.APP_ENV = 'development';
    expect(resolveEnvironment()).toBe('DEVELOPMENT');
  });

  it('returns DEVELOPMENT (safe fallback) when APP_ENV is absent', () => {
    delete process.env.APP_ENV;
    expect(resolveEnvironment()).toBe('DEVELOPMENT');
  });

  it('returns DEVELOPMENT (safe fallback) for unrecognised values', () => {
    process.env.APP_ENV = 'some-unknown-context';
    expect(resolveEnvironment()).toBe('DEVELOPMENT');
  });

  it('does NOT return PRODUCTION when APP_ENV is absent (Netlify Deploy Preview safety)', () => {
    delete process.env.APP_ENV;
    expect(resolveEnvironment()).not.toBe('PRODUCTION');
  });

  it('is case-insensitive for APP_ENV values', () => {
    process.env.APP_ENV = 'PRODUCTION';
    expect(resolveEnvironment()).toBe('PRODUCTION');

    process.env.APP_ENV = 'STAGING';
    expect(resolveEnvironment()).toBe('STAGING');
  });
});
