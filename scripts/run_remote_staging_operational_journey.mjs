#!/usr/bin/env node

// Rerun marker: profile roles use the canonical application values enforced by
// profiles_role_canonical; company ownership remains in company_memberships.
// P0 prerequisite: verified successfully at 205/205 disposable migrations.
// POD evidence is uploaded to the private staging bucket before submission.
import { readFile, writeFile, unlink } from 'node:fs/promises';

const sourceUrl = new URL('./validate_remote_staging_operational_journey.mjs', import.meta.url);
const generatedUrl = new URL('./.generated_operational_journey_roles.mjs', import.meta.url);

const original = await readFile(sourceUrl, 'utf8');
const legacyFixture = "    [buyer, buyerCompany, buyerEmail, 'owner', false],\n    [carrier, carrierCompany, carrierEmail, 'owner', true],";
const canonicalFixture = "    [buyer, buyerCompany, buyerEmail, 'customer', false],\n    [carrier, carrierCompany, carrierEmail, 'driver', true],";
const legacyPodFixture = "  const podPhotoPath = `${jobId}/delivery/authenticated-pod-photo.jpg`;\n  await driverAction('pod', 200, {";
const persistentPodFixture = "  const podPhotoPath = `${jobId}/photos/authenticated-pod-photo.jpg`;\n  const { error: podUploadError } = await service.storage\n    .from('pod-docs')\n    .upload(podPhotoPath, new TextEncoder().encode('authenticated disposable staging POD photo'), {\n      contentType: 'image/jpeg',\n      upsert: true,\n    });\n  if (podUploadError) throw new Error(`POD storage fixture failed: ${podUploadError.message}`);\n  await driverAction('pod', 200, {";

const roleOccurrences = original.split(legacyFixture).length - 1;
if (roleOccurrences !== 1) {
  throw new Error(`Expected exactly one operational profile-role fixture, found ${roleOccurrences}.`);
}
const podOccurrences = original.split(legacyPodFixture).length - 1;
if (podOccurrences !== 1) {
  throw new Error(`Expected exactly one operational POD fixture, found ${podOccurrences}.`);
}

const generated = original
  .replace(legacyFixture, canonicalFixture)
  .replace(legacyPodFixture, persistentPodFixture);
await writeFile(generatedUrl, generated, 'utf8');

try {
  await import(`${generatedUrl.href}?run=${Date.now()}`);
} finally {
  await unlink(generatedUrl).catch(() => undefined);
}
