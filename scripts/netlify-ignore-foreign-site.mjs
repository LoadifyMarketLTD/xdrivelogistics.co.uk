const OFFICIAL_SITE_NAME = 'xdrivelogistics';

const siteName = (process.env.SITE_NAME ?? '').trim();
const onNetlify = process.env.NETLIFY === 'true';

// Netlify ignore command semantics:
//   exit 0 => skip/cancel this build intentionally
//   exit 1 => continue with the build
// Local/non-Netlify environments must never be skipped by this guard.
if (!onNetlify) {
  process.exit(1);
}

if (!siteName) {
  console.error('Netlify SITE_NAME is missing; refusing to classify this deployment as a foreign duplicate.');
  process.exit(1);
}

if (siteName !== OFFICIAL_SITE_NAME) {
  console.log(`Skipping Netlify build for non-canonical site "${siteName}". Canonical XDrive site is "${OFFICIAL_SITE_NAME}".`);
  process.exit(0);
}

process.exit(1);
