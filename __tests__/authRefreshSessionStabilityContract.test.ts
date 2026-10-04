import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/AuthContext.tsx'), 'utf8');

describe('Auth refresh session stability contract', () => {
  it('does not clear the last verified user before authoritative context refresh completes', () => {
    const start = source.indexOf('const refreshUserContext = useCallback');
    const resolve = source.indexOf('resolveAuthenticatedUser(session.user)', start);
    const preResolve = source.slice(start, resolve);
    expect(preResolve).toContain('Keep the last verified user while the authoritative context is rebuilt.');
    expect(preResolve).not.toContain('setUser(null)');
    expect(preResolve).not.toContain('userRef.current = null');
  });

  it('preserves the verified user for transient database and service failures', () => {
    expect(source).toContain("if (result.reason !== 'db_error')");
    const catchStart = source.indexOf("console.error('AuthContext forced refresh failed'");
    const serviceStart = source.indexOf('if (isServiceUnavailableError(error))', catchStart);
    const clearStart = source.indexOf('setUser(null)', catchStart);
    expect(serviceStart).toBeGreaterThan(catchStart);
    expect(clearStart).toBeGreaterThan(serviceStart);
  });
});
