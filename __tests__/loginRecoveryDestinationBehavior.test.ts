import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('app/login/page.tsx', 'utf8');
const ast = ts.createSourceFile('LoginPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function submitHandler(scope: Record<string, unknown>) {
  let node: ts.ArrowFunction | undefined;
  function walk(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'handleSubmit' && n.initializer && ts.isArrowFunction(n.initializer)) node = n.initializer;
    ts.forEachChild(n, walk);
  }
  walk(ast);
  if (!node) throw Error('Missing login submit handler');
  const js = ts.transpileModule('return (' + (node as ts.ArrowFunction).getText(ast) + ');', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), js)(...Object.values(scope)) as (event: { preventDefault: () => void }) => Promise<void>;
}
async function exercise(route: string, safeNextPath: string | null, success = true) {
  const scope = {
    clientReady: true, isLoading: false, setError: vi.fn(), setIsLoading: vi.fn(),
    login: vi.fn(async () => ({ success, route, error: success ? undefined : 'Synthetic failure' })),
    email: 'fixture@example.invalid', password: 'fixture-only', safeNextPath,
    router: { replace: vi.fn() },
  };
  await submitHandler(scope)({ preventDefault: vi.fn() });
  return scope;
}

describe('login submit recovery and mandatory password routing', () => {
  it.each(['/onboarding/documents', '/onboarding/documents?return=1', '/settings/payments'])('mandatory password route takes precedence over %s', async next => {
    const s = await exercise('/driver/change-password', next);
    expect(s.router.replace).toHaveBeenCalledExactlyOnceWith('/driver/change-password');
  });
  it.each(['/onboarding/resume', '/pending-approval'])('keeps canonical recovery destination %s', async route => {
    const s = await exercise(route, null);
    expect(s.router.replace).toHaveBeenCalledExactlyOnceWith(route);
  });
  it.each(['/onboarding/documents', '/onboarding/documents?return=1', '/settings/payments?return=1'])('preserves approved self-service destination %s', async next => {
    const s = await exercise('/onboarding/resume', next);
    expect(s.router.replace).toHaveBeenCalledExactlyOnceWith(next);
  });
  it('does not navigate after failed authentication', async () => {
    const s = await exercise('/admin', '/settings/payments', false);
    expect(s.router.replace).not.toHaveBeenCalled();
    expect(s.setError).toHaveBeenCalledWith('Synthetic failure');
  });
  it('does not allow an arbitrary requested destination to override canonical recovery', async () => {
    const s = await exercise('/onboarding/resume', '/admin');
    expect(s.router.replace).toHaveBeenCalledExactlyOnceWith('/onboarding/resume');
  });
});
