/**
 * Deployment environment detection for Netlify.
 *
 * The project deploys on Netlify. Resolving the environment banner label
 * relies solely on the owner-managed `APP_ENV` environment variable, which
 * must be configured in the Netlify dashboard with context-specific values:
 *
 *   Production deploy  → APP_ENV=production
 *   Deploy Preview     → APP_ENV=staging
 *   Branch Deploy      → APP_ENV=staging
 *   Local / dev server → APP_ENV=development  (or omit; falls through to DEVELOPMENT)
 *
 * Intentionally excluded variables:
 *   - `VERCEL_ENV`: irrelevant on Netlify.
 *   - `NETLIFY_CONTEXT`: a build-time variable not automatically available in
 *     Netlify Functions at runtime unless the owner explicitly propagates it as
 *     a scoped environment variable.
 *   - `NODE_ENV`: Next.js sets this to `'production'` for any optimised build,
 *     including Deploy Previews, so it cannot reliably distinguish production
 *     from staging on Netlify.
 *
 * When `APP_ENV` is absent or unrecognised the function returns `'DEVELOPMENT'`
 * (a safe non-production label) rather than `'PRODUCTION'`, preventing a
 * Deploy Preview or branch deploy from being mislabelled as the production
 * environment.
 *
 * Required Netlify configuration (add in the Netlify dashboard):
 *   Variable: APP_ENV
 *   Scope: Builds, Functions, Runtime
 *   Production:      production
 *   Deploy Previews: staging
 *   Branch Deploys:  staging
 *   Local / dev:     development
 */
export function resolveEnvironment(): 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' {
  const appEnv = (process.env.APP_ENV ?? '').toLowerCase().trim();
  if (appEnv === 'production') return 'PRODUCTION';
  if (appEnv === 'staging' || appEnv === 'preview') return 'STAGING';
  // Default to DEVELOPMENT (safe non-production label) when APP_ENV is absent
  // or does not match a recognised value.
  return 'DEVELOPMENT';
}
