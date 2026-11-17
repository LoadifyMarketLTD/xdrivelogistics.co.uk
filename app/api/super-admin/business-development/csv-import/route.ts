import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmDomain, crmHttps, crmResponse } from '../_lib/server';

export const dynamic = 'force-dynamic';
const fields = ['legal_name','company_number','website','legal_form','segment','source_url'];
const legalForms = new Set(['ltd','llp','sole_trader','other','unknown']);
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);

function parseCsv(source: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i=0; i<source.length; i++) {
    const char=source[i];
    if (char === '"') {
      if (quoted && source[i+1] === '"') { value+='"'; i++; }
      else if (quoted || value==='') quoted=!quoted;
      else throw Error('Invalid quoting');
    } else if (char===',' && !quoted) { row.push(value.trim());value=''; }
    else if ((char==='\n' || char==='\r') && !quoted) {
      if (char==='\r' && source[i+1]==='\n') i++;
      row.push(value.trim()); if(row.some(Boolean))lines.push(row);
      row=[]; value='';
    } else value+=char;
  }
  if(quoted)throw Error('Unclosed quote');
  row.push(value.trim()); if(row.some(Boolean)) lines.push(row);
  return lines;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  let body: { csv?: unknown; preview_sha256?: unknown; reviewed?: unknown; confirmation?: unknown };
  try { body = await request.json(); }
  catch { return crmResponse(400, { error: 'Invalid JSON.' }); }
  if (!body || typeof body.csv !== 'string' || body.csv.length > 250000 ||
      body.reviewed !== true || body.confirmation !== 'IMPORT_VERIFIED_PROSPECTS')
    return crmResponse(400, { error: 'Owner-reviewed CSV (maximum 250 KB) and explicit confirmation required.' });
  const csv = body.csv.replace(/^\uFEFF/,'');
  const digest = createHash('sha256').update(csv,'utf8').digest('hex');
  if (digest !== body.preview_sha256)
    return crmResponse(409, { error: 'CSV content changed since preview. Review it again.' });
  let parsed: string[][];
  try { parsed = parseCsv(csv); } catch { return crmResponse(400, { error: 'Malformed CSV.' }); }
  if (parsed.length < 2 || parsed.length > 101 ||
      parsed[0].length !== fields.length || parsed[0].some((name,i) => name !== fields[i]))
    return crmResponse(400, { error: 'Expected standard header and 1–100 records.' });
  const seen = new Set<string>();
  const rows = [];
  for (let i=1; i<parsed.length; i++) {
    const values=parsed[i];
    const row=Object.fromEntries(fields.map((name,index)=>[name, values[index]??''])) as Record<string,string>;
    if (values.length !== fields.length || row.legal_name.length<2 || row.legal_name.length>240 ||
        row.company_number.length>32 || !legalForms.has(row.legal_form) || !segments.has(row.segment) ||
        !crmHttps(row.source_url) || (row.website && !crmHttps(row.website))) {
      return crmResponse(400, { error: 'Invalid data or source in CSV row ' + (i+1) });
    }
    const domain = row.website ? crmDomain(row.website) : null;
    const number = row.company_number.trim().replace(/\s/g,'').toUpperCase();
    if (!number && !domain)
      return crmResponse(400, { error: 'Company number or verified HTTPS website required in row ' + (i+1) });
    const key = number ? 'number:' + number : 'domain:' + domain;
    if (seen.has(key)) return crmResponse(409, { error: 'Duplicate in CSV row ' + (i+1) });
    seen.add(key);
    rows.push({
      legal_name: row.legal_name.trim(), company_number: number || null,
      website: row.website.trim() || null, website_domain: domain,
      legal_form: row.legal_form, segment: row.segment,
      source_type: 'owner_csv', source_url: row.source_url.trim(),
      source_reference: 'Owner reviewed CSV sha256:' + digest,
      source_checked_at: new Date().toISOString(), created_by: auth.owner!.id, last_actor_id: auth.owner!.id,
    });
  }
  // Single PostgREST INSERT: transaction succeeds as a whole or fails on a
  // conflict. Unique constraints protect concurrent imports.
  const { data, error } = await supabaseAdmin!.from('crm_prospect_organisations')
    .insert(rows).select('id,legal_name,company_number');
  if (error) return crmResponse(error.code==='23505' ? 409 : 503, {
    error: error.code==='23505' ? 'Duplicate organisation: no rows imported.' : 'CRM import failed: no rows imported.',
  });
  return crmResponse(201, {
    imported: data?.length ?? 0, organisations: data ?? [],
    contacts_imported: 0, messages_sent: 0, source: 'owner-reviewed CSV',
  });
}
