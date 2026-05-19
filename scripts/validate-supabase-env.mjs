const EXPECTED_SUPABASE_URL =
  process.env.EXPECTED_NEXT_PUBLIC_SUPABASE_URL ??
  'https://jqxlauexhkonixtjvljw.supabase.co';

const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const shouldValidate =
  process.env.NETLIFY === 'true' ||
  process.env.CONTEXT === 'production' ||
  process.env.SUPABASE_ENV_STRICT === 'true';

if (!shouldValidate) {
  process.exit(0);
}

const normalizeUrl = (value) => value.replace(/\/+$/, '');
const normalizedExpected = normalizeUrl(EXPECTED_SUPABASE_URL);
const normalizedCurrent = normalizeUrl(currentUrl);

if (!normalizedCurrent) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL in deployment environment variables.'
  );
  process.exit(1);
}

if (normalizedCurrent !== normalizedExpected) {
  console.error(
    `Invalid NEXT_PUBLIC_SUPABASE_URL. Expected "${normalizedExpected}" but received "${normalizedCurrent}".`
  );
  process.exit(1);
}

if (!anonKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in deployment environment variables.'
  );
  process.exit(1);
}

console.log('Supabase production environment validation passed.');
