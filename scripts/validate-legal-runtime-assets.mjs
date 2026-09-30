import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const fonts = ['inter-latin-ext-400-normal.woff', 'inter-latin-ext-700-normal.woff'];
const traces = [
  '.next/server/app/api/account/legal-agreements/route.js.nft.json',
  '.next/server/app/api/onboarding/init/route.js.nft.json',
];
for (const trace of traces) {
  if (!existsSync(trace)) throw new Error(`Legal runtime trace missing: ${trace}`);
  const { files } = JSON.parse(readFileSync(trace, 'utf8'));
  for (const font of fonts) {
    const entry = files.find(file => file.replaceAll('\\', '/').endsWith('/' + font));
    if (!entry || !existsSync(resolve(dirname(trace), entry))) {
      throw new Error(`Legal PDF deployment asset missing: ${font} in ${trace}`);
    }
  }
}
console.log('LEGAL_PDF_RUNTIME_ASSETS=PASS (two font assets in both authenticated signing routes)');
