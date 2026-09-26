import fs from 'node:fs';
import path from 'node:path';

const groups = ['E2E_CUSTOMER','E2E_BROKER','E2E_CARRIER','E2E_DRIVER'];
const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? '').trim();
const production = /^https:\/\/(?:www\.)?xdrivelogistics\.co\.uk\/?$/i.test(baseUrl);
const allowMutation = process.env.E2E_ALLOW_PRODUCTION_MUTATION === 'true';
const approved = new Set((process.env.E2E_APPROVED_TEST_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
const accounts = groups.map((group) => {
  const email = (process.env[group + '_EMAIL'] ?? '').trim().toLowerCase();
  const password = process.env[group + '_PASSWORD'] ?? '';
  const companyId = (process.env[group + '_COMPANY_ID'] ?? '').trim();
  const approvedEmail = /(^|[+._-])e2e([+._-]|@)/i.test(email) || approved.has(email);
  const companyIdPresent = /^[0-9a-f-]{36}$/i.test(companyId);
  return { group, emailPresent:Boolean(email), passwordPresent:Boolean(password), companyIdPresent, approved:approvedEmail, ready:Boolean(email && password && approvedEmail && companyIdPresent) };
});

const blockers = [];
if (!baseUrl) blockers.push('PLAYWRIGHT_BASE_URL or E2E_BASE_URL is not configured.');
if (production && !allowMutation) blockers.push('E2E_ALLOW_PRODUCTION_MUTATION=true is required for approved mutating production scenarios.');
for (const account of accounts) if (!account.ready) blockers.push(account.group + ' approved credentials or company ID are incomplete.');
const result = {
  generatedAt: new Date().toISOString(),
  baseUrlConfigured: Boolean(baseUrl),
  productionTarget: production,
  productionMutationAllowed: allowMutation,
  accounts: accounts.map(({ group, emailPresent, passwordPresent, companyIdPresent, approved: isApproved, ready }) => ({ group, emailPresent, passwordPresent, companyIdPresent, approved:isApproved, ready })),
  status: blockers.length ? 'BLOCKED' : 'READY',
  blockers,
};

const outDir = path.join(process.cwd(), 'artifacts', 'e2e');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'contract-master-preflight.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exitCode = blockers.length ? 2 : 0;