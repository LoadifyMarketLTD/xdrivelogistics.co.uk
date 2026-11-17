import { NextRequest } from 'next/server';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic = 'force-dynamic';

const registryBase = 'https://api.company-information.service.gov.uk';
const publicBase = 'https://find-and-update.company-information.service.gov.uk/company/';
const validNumber = (value:string) => /^[A-Z0-9]{2,8}$/.test(value);

export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const number = (request.nextUrl.searchParams.get('company_number') ?? '').trim().toUpperCase();
  const search = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const isSearch = !number && !!search;
  if (isSearch && (search.length < 3 || search.length > 100 || /[<>\\]/.test(search)))
    return crmResponse(400, { error: 'Search query must contain 3–100 ordinary characters.' });
  if (!isSearch && !validNumber(number))
    return crmResponse(400, { error: 'Valid Companies House number or search query required.' });
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return crmResponse(503, {
    error: 'Companies House API key is not configured. Manual public-register verification remains available.',
  });
  try {
    const path = isSearch
      ? '/search/companies?q=' + encodeURIComponent(search) + '&items_per_page=20&start_index=0'
      : '/company/' + encodeURIComponent(number);
    const response = await fetch(registryBase + path, {
      method: 'GET', headers: {
        Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
        Accept: 'application/json',
      }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return crmResponse(404, { error: 'No matching company in the official register.' });
    if (!response.ok) return crmResponse(response.status===429?503:502, {
      error: response.status===429?'Companies House rate limit reached.':'Companies House official lookup unavailable.',
    });
    const checkedAt = new Date().toISOString();
    if (isSearch) {
      const result = await response.json() as {
        items?: Array<{
          title?: string; company_number?: string; company_status?: string; company_type?: string; kind?: string;
        }>;
      };
      const companies = (result.items ?? []).slice(0,20)
        .filter(item => typeof item.company_number==='string' && validNumber(item.company_number.toUpperCase()))
        .map(item => ({
          company_name: item.title ?? null, company_number: item.company_number!,
          company_status: item.company_status ?? null, company_type: item.company_type ?? null,
          source_url: publicBase + item.company_number, checked_at: checkedAt,
        }));
      return crmResponse(200, {
        companies, count: companies.length, imported: false,
        note: 'Read-only official registry search. Results are not prospects until independently verified.',
      });
    }
    const company = await response.json() as {
      company_name?: string; company_number?: string; company_status?: string;
      type?: string; date_of_creation?: string;
    };
    return crmResponse(200, {
      company_name: company.company_name ?? null,
      company_number: company.company_number ?? number,
      company_status: company.company_status ?? null, company_type: company.type ?? null,
      date_of_creation: company.date_of_creation ?? null,
      source_url: publicBase + number,
      checked_at: checkedAt, imported: false,
      note: 'Read-only official register lookup. Verify activity and legal identity before owner intake.',
    });
  } catch {
    return crmResponse(502, { error: 'Companies House lookup failed or timed out.' });
  }
}
