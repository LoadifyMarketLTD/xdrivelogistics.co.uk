import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: [
      'e2e/**', 'node_modules/**',
      // Retired 2026-11-07: these tests assert removed demo/legacy routes,
      // not the canonical /driver application. Operational contracts remain active.
      '__tests__/driverBookingPage0Acceptance.test.ts',
      '__tests__/driverBookingStoryboardPage0.test.ts',
      '__tests__/driverBookingStoryboardNavigationChain.test.ts',
    ],
  },
});
