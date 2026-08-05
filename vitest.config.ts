import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Prevent esbuild from resolving the expo/tsconfig.base extend in the
    // apps/driver-mobile sub-package, which is not installed at root.
    tsconfigRaw: '{"compilerOptions":{"strict":true}}',
  },
  test: {
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
