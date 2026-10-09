import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('protected route background auth stability contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/components/ProtectedRoute.tsx'), 'utf8');

  it('keeps an authenticated workspace mounted during background auth loading', () => {
    expect(source).toContain('if ((isLoading && !user) || (!user && hasSupabaseSession))');
    expect(source).not.toContain('if (isLoading || (!user && hasSupabaseSession))');
  });
});
