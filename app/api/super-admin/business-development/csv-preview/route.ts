import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

export const dynamic = 'force-dynamic';
type Row = { legal_name: string; company_number: string; website: string; legal_form: string; segment: string; source_url: string };
const legalForms = new Set(['ltd','llp','sole_trader','other','unknown']);
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);
function isHttps(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === '') quoted = !quoted;
      else throw new Error('Invalid CSV quoting');
    } else if (ch === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return NextResponse.json({ error: 'CRM unavailable' }, { status: 503 });
  if (!hasSuperAdminBearerAuthorization(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!await verifyPlatformOwner(request)) return NextResponse.json({ error: 'Owner required or preview write disabled' }, { status: 403 });
  // Preview-only: never import or persist any submitted row.
  let csv: string;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as { csv?: unknown }).csv !== 'string') throw Error();
    csv = (body as { csv: string }).csv;
  } catch { return NextResponse.json({ error: 'Expected JSON with CSV text' }, { status: 400 }); }
  if (csv.length > 250000) return NextResponse.json({ error: 'CSV exceeds 250 KB' }, { status: 413 });
  let parsed: string[][];
  try { parsed = parseCsv(csv.replace(/^\uFEFF/, '')); }
  catch { return NextResponse.json({ error: 'Malformed CSV' }, { status: 400 }); }
  if (parsed.length < 2 || parsed.length > 101) return NextResponse.json({ error: 'Supply 1–100 prospect rows' }, { status: 400 });
  const required = ['legal_name','company_number','website','legal_form','segment','source_url'];
  const header = parsed[0];
  if (header.length !== required.length || header.some((name, i) => name !== required[i]))
    return NextResponse.json({ error: 'CSV headers must be: ' + required.join(',') }, { status: 400 });
  const seen = new Set<string>();
  const rows: { row: number; valid: boolean; errors: string[]; duplicateInFile: boolean; alreadyExists: boolean }[] = [];
  const candidates: { row: number; data: Row; errors: string[]; key: string }[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const values = parsed[i]; const data = Object.fromEntries(required.map((key, n) => [key, values[n] ?? ''])) as Row;
    const errors: string[] = [];
    if (values.length !== required.length) errors.push('Column count mismatch');
    if (data.legal_name.length < 2 || data.legal_name.length > 240) errors.push('Invalid legal name');
    if (data.company_number.length > 32) errors.push('Invalid company number');
    if (data.website && (!isHttps(data.website) || data.website.length > 2048)) errors.push('Invalid HTTPS website');
    if (!isHttps(data.source_url) || data.source_url.length > 2048) errors.push('Missing HTTPS provenance');
    if (!legalForms.has(data.legal_form)) errors.push('Invalid legal form');
    if (!segments.has(data.segment)) errors.push('Invalid segment');
    const key = data.company_number ? 'number:' + data.company_number.replace(/\s/g, '').toUpperCase() : 'name:' + data.legal_name.trim().toLowerCase();
    if (seen.has(key)) errors.push('Duplicate within CSV');
    seen.add(key); candidates.push({ row: i + 1, data, errors, key });
  }
  // Existing-record checks are read-only; no database writes.
  const numbers = [...new Set(candidates.map(c => c.data.company_number.trim().toUpperCase()).filter(Boolean))];
  const existing = new Set<string>();
  if (numbers.length) {
    const { data, error } = await supabaseAdmin.from('crm_prospect_organisations').select('company_number').in('company_number', numbers);
    if (error) return NextResponse.json({ error: 'Duplicate check unavailable' }, { status: 503 });
    for (const record of data ?? []) if (record.company_number) existing.add(record.company_number.trim().toUpperCase());
  }
  for (const c of candidates) {
    const alreadyExists = !!c.data.company_number && existing.has(c.data.company_number.trim().toUpperCase());
    if (alreadyExists) c.errors.push('Company number already in CRM');
    rows.push({ row: c.row, valid: c.errors.length === 0, errors: c.errors, duplicateInFile: c.errors.includes('Duplicate within CSV'), alreadyExists });
  }
  return NextResponse.json({ dryRun: true, writes: 0, total: rows.length, valid: rows.filter(r => r.valid).length, rows }, { headers: { 'Cache-Control': 'no-store' } });
}
