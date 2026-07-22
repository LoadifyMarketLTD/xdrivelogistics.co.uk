#!/usr/bin/env node

// Rerun marker: profile roles use the canonical application values enforced by
// profiles_role_canonical; company ownership remains in company_memberships.
import { readFile, writeFile, unlink } from 'node:fs/promises';

const sourceUrl = new URL('./validate_remote_staging_operational_journey.mjs', import.meta.url);
const generatedUrl = new URL('./.generated_operational_journey_roles.mjs', import.meta.url);

const original = await readFile(sourceUrl, 'utf8');
const legacyFixture = "    [buyer, buyerCompany, buyerEmail, 'owner', false],\n    [carrier, carrierCompany, carrierEmail, 'owner', true],";
const canonicalFixture = "    [buyer, buyerCompany, buyerEmail, 'customer', false],\n    [carrier, carrierCompany, carrierEmail, 'driver', true],";

const occurrences = original.split(legacyFixture).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one operational profile-role fixture, found ${occurrences}.`);
}

await writeFile(generatedUrl, original.replace(legacyFixture, canonicalFixture), 'utf8');

try {
  await import(`${generatedUrl.href}?run=${Date.now()}`);
} finally {
  await unlink(generatedUrl).catch(() => undefined);
}
