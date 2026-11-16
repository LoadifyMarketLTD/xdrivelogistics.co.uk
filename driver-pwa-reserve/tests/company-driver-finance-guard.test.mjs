import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const invoice=readFileSync(new URL('../src/LiveInvoiceFlow.tsx',import.meta.url),'utf8');
const endpoint=readFileSync(new URL('../../app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts',import.meta.url),'utf8');
const roleCaps=readFileSync(new URL('../../lib/roleCapabilities.ts',import.meta.url),'utf8');

test('finance authorization is resolved from active company membership, never a UI driver-type label',()=>{
 assert.match(endpoint,/async function resolveFinanceOwner\(driver: WebDriverContext\)/);
 assert.match(endpoint,/\.from\('company_memberships'\)/);
 assert.match(endpoint,/\.eq\('user_id', driver\.userId\)/);
 assert.match(endpoint,/\.eq\('status', 'active'\)/);
 assert.match(endpoint,/canManageFinance: role === 'owner' \|\| role === 'admin'/);
 assert.doesNotMatch(endpoint,/driver\.driver_type/);
});
test('invoice mutation fails closed for unauthorized driver and requires a feature gate',()=>{
 assert.match(endpoint,/const driver = await requireActiveWebDriver\(request\)/);
 assert.match(endpoint,/if \(!actor\) return respond\(401/);
 assert.match(endpoint,/if \(!actor\.canManageFinance\)/);
 assert.match(endpoint,/return respond\(403, \{ error: 'Company owner or admin access is required to create invoices\.'/);
 assert.match(endpoint,/getFeatureFlag\(supabaseAdmin, 'invoice_generation'\)/);
 assert.match(endpoint,/if \(!idempotencyKey\) return respond\(400/);
});
test('driver invoice UI delegates to protected API and central workspace capability model',()=>{
 assert.match(app,/<LiveInvoiceFlow/);
 assert.match(invoice,/\/finance\/jobs\/'\+encodeURIComponent\(job\.id\)\+'\/generate-invoice'/);
 assert.match(roleCaps,/membershipRole\?: string \| null/);
 assert.match(roleCaps,/financeAccess\?: 'full' \| 'limited' \| 'hidden' \| null/);
 assert.doesNotMatch(app,/const canInvoice=role==='Owner Driver'/);
});
