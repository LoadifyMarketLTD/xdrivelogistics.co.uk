/**
 * Shared read-only Companies House transport for onboarding and CRM.
 * This module NEVER registers a business, creates a lead, or contacts a person.
 * All callers still enforce their own role, legal identity and lifecycle gates.
 */
export const companiesHousePublicUrl = 'https://find-and-update.company-information.service.gov.uk/company/';
const API_BASE = 'https://api.company-information.service.gov.uk/';

export function normalizeCompaniesHouseNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Allow only internal relative Companies House paths: no scheme or authority. */
export async function companiesHouseRead(
  relativePath: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<Response> {
  if (!relativePath || relativePath.startsWith('/') || relativePath.startsWith('//') ||
      relativePath.includes('://') || relativePath.includes('\\') ||
      !/^(company\/[A-Z0-9]{2,16}|search\/companies\?|advanced-search\/companies\?)/.test(relativePath))
    throw new Error('Unapproved Companies House endpoint');
  return fetch(API_BASE + relativePath, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });
}

export function isMatchingCompaniesHouseIdentity(
  profile: { company_number?: unknown; company_name?: unknown },
  requestedNumber: string,
): boolean {
  return typeof profile.company_number === 'string' &&
    normalizeCompaniesHouseNumber(profile.company_number) === normalizeCompaniesHouseNumber(requestedNumber) &&
    typeof profile.company_name === 'string' && profile.company_name.trim().length > 0;
}
