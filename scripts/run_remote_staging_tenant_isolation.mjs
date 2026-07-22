#!/usr/bin/env node

// Rerun marker: P0 disposable staging schema verified at 204/204 migrations.
import { readFile, writeFile, unlink } from 'node:fs/promises';

const sourceUrl = new URL('./validate_remote_staging_tenant_isolation.mjs', import.meta.url);
const generatedUrl = new URL('./.generated_tenant_isolation_company_admin.mjs', import.meta.url);

const original = await readFile(sourceUrl, 'utf8');
const ownerFixture = "      role: 'owner',\n      status: 'active',";
const companyAdminFixture = "      role: 'company_admin',\n      status: 'active',";

const occurrences = original.split(ownerFixture).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one tenant fixture profile owner role, found ${occurrences}.`);
}

const generated = original.replace(ownerFixture, companyAdminFixture);
await writeFile(generatedUrl, generated, 'utf8');

try {
  await import(`${generatedUrl.href}?run=${Date.now()}`);
} finally {
  await unlink(generatedUrl).catch(() => undefined);
}
