import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../app/login/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({replace: vi.fn()}),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({default: () => null}));
vi.mock('next/link', () => ({default: ({children}: {children: React.ReactNode}) => children}));
vi.mock('../app/components/AuthContext', () => ({
  useAuth: () => ({login: vi.fn(), resetPassword: vi.fn(), user: null, isLoading:true}),
}));
vi.mock('../lib/authSession', () => ({
  getResponsivePostLoginRoute: vi.fn(), roleCanAccessPath: vi.fn(),
}));

describe('XD-AUD-0012A login pre-hydration safety', () => {
  const html = renderToString(<LoginPage />);
  it('prevents early typing into credentials before client handlers exist', () => {
    for (const type of ['email','password']) {
      const input = html.match(new RegExp('<input[^>]*type="'+type+'"[^>]*>'))?.[0];
      expect(input).toBeDefined();
      expect(input).toMatch(/ disabled="[^"]*"/);
    }
  });
  it('keeps native submit disabled until React has hydrated', () => {
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
    expect(submit).toBeDefined();
    expect(submit).toMatch(/ disabled="[^"]*"/);
  });
  it('prevents native GET form fallback', () => {
    expect(html).toMatch(/<form[^>]*method="post"/i);
  });
  it('keeps the recovery action disabled until hydration', () => {
    expect(html).toMatch(/<button[^>]*disabled="[^"]*"[^>]*>Forgot password\?<\/button>/);
  });
  it('provides a clear initial waiting state', () => {
    expect(html).toContain('Preparing sign-in');
  });
});
