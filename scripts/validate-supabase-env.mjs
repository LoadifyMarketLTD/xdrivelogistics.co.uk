const PRODUCTION_SUPABASE_URL =
  process.env.EXPECTED_NEXT_PUBLIC_SUPABASE_URL ??
  'https://jqxlauexhkonixtjvljw.supabase.co';

const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const context = process.env.CONTEXT?.trim() ?? '';

const shouldValidate =
  process.env.NETLIFY === 'true' ||
  context === 'production' ||
  process.env.SUPABASE_ENV_STRICT === 'true';

if (!shouldValidate) {
  process.exit(0);
}

const normalizeUrl = (value) => value.replace(/\/+$/, '');
const isValidSupabaseUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('supabase.co');
  } catch {
    return false;
  }
};
const looksLikeSupabasePublicKey = (value) =>
  value.startsWith('sb_publishable_') || value.split('.').length === 3;

const normalizedProduction = normalizeUrl(PRODUCTION_SUPABASE_URL);
const normalizedCurrent = normalizeUrl(currentUrl);
const configuredPreviewExpected = process.env.EXPECTED_DEPLOY_PREVIEW_SUPABASE_URL?.trim();
const normalizedPreviewExpected = configuredPreviewExpected
  ? normalizeUrl(configuredPreviewExpected)
  : '';

if (!normalizedCurrent) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL in deployment environment variables.'
  );
  process.exit(1);
}

if (!isValidSupabaseUrl(normalizedCurrent)) {
  console.error(
    `Invalid NEXT_PUBLIC_SUPABASE_URL. Expected an https://<project>.supabase.co URL but received "${normalizedCurrent}".`
  );
  process.exit(1);
}

if (context === 'deploy-preview') {
  if (normalizedCurrent === normalizedProduction) {
    console.error(
      'Deploy Preview is pointed at the production Supabase project. Configure a preview/branch Supabase URL for the Deploy Previews context.'
    );
    process.exit(1);
  }

  if (
    normalizedPreviewExpected &&
    normalizedCurrent !== normalizedPreviewExpected
  ) {
    console.error(
      `Invalid Deploy Preview NEXT_PUBLIC_SUPABASE_URL. Expected "${normalizedPreviewExpected}" but received "${normalizedCurrent}".`
    );
    process.exit(1);
  }
} else if (normalizedCurrent !== normalizedProduction) {
  console.error(
    `Invalid NEXT_PUBLIC_SUPABASE_URL for context "${context || 'unknown'}". Expected "${normalizedProduction}" but received "${normalizedCurrent}".`
  );
  process.exit(1);
}

if (!anonKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in deployment environment variables. Configure it in the Netlify site environment settings.'
  );
  process.exit(1);
}

if (!looksLikeSupabasePublicKey(anonKey)) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a valid Supabase public key.'
  );
  process.exit(1);
}

console.log(
  context === 'deploy-preview'
    ? 'Supabase Deploy Preview environment validation passed.'
    : 'Supabase production environment validation passed.'
);
