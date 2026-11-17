import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmDomain, crmHttps, crmResponse } from '../_lib/server';

export const dynamic = 'force-dynamic';
const headers = ['legal_name','company_number','website','legal_form','segment','source_url'];
const forms = new Set(['ltd','llp','sole_trader','other','unknown']);
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);

function parseCsv(csv: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i=0;i<csv.length;i++) {
    const c=csv[i];
    if(c==='"') {
      if(quoted && csv[i+1]==='"') {cell+='"';i++;}
      else if(quoted || cell==='')quoted=!quoted;
      else throw Error('Invalid quoting');
    } else if(c===',' && !quoted) {row.push(cell.trim());cell='';}
    else if((c==='\r'||c==='\n') && !quoted) {
      if(c==='\r' && csv[i+1]==='\n')i++;
      row.push(cell.trim());if(row.some(Boolean))result.push(row);
      row=[];cell='';
    } else cell+=c;
  }
  if(quoted)throw Error('Unterminated CSV quote');
  row.push(cell.trim());if(row.some(Boolean))result.push(row);
  return result;
}
type ReviewRow={
  row:number;valid:boolean;errors:string[];duplicateInFile:boolean;alreadyExists:boolean;
};
export async function POST(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  let csv:string;
  try {
    const input:unknown=await request.json();
    if(!input || typeof input!=='object' || Array.isArray(input) ||
       typeof (input as {csv?:unknown}).csv!=='string')throw Error();
    csv=(input as {csv:string}).csv;
  } catch{return crmResponse(400,{error:'Expected JSON object with CSV text.'});}
  if(csv.length>250000)return crmResponse(413,{error:'CSV exceeds 250 KB.'});
  csv=csv.replace(/^\uFEFF/,'');
  let parsed:string[][];
  try {parsed=parseCsv(csv);}catch{return crmResponse(400,{error:'Malformed CSV file.'});}
  if(parsed.length<2 || parsed.length>101)return crmResponse(400,{error:'Provide 1–100 prospect rows.'});
  if(parsed[0].length!==headers.length || parsed[0].some((column,i)=>column!==headers[i]))
    return crmResponse(400,{error:'Required headers: '+headers.join(',')});
  const seenNumbers=new Set<string>(),seenDomains=new Set<string>();
  const existingNumbers=new Set<string>(),existingDomains=new Set<string>();
  const candidates: {
    row:number;number:string;domain:string|null;errors:string[];duplicateInFile:boolean;
  }[]=[];
  for(let i=1;i<parsed.length;i++) {
    const values=parsed[i];
    const data=Object.fromEntries(headers.map((key,n)=>[key,values[n]??''])) as Record<string,string>;
    const errors:string[]=[];
    const number=data.company_number.replace(/\s/g,'').toUpperCase();
    const domain=data.website?crmDomain(data.website):null;
    if(values.length!==headers.length)errors.push('Column count mismatch');
    if(data.legal_name.length<2 || data.legal_name.length>240)errors.push('Invalid legal name');
    if(data.company_number.length>32)errors.push('Invalid company number');
    if(data.website && (!crmHttps(data.website)||!domain))errors.push('Invalid HTTPS website');
    if(!crmHttps(data.source_url))errors.push('Invalid source URL');
    if(!forms.has(data.legal_form))errors.push('Invalid legal form');
    if(!segments.has(data.segment))errors.push('Invalid segment');
    if(!number && !domain)errors.push('Company number or verified website is required');
    let duplicateInFile=false;
    if(number && seenNumbers.has(number))duplicateInFile=true;
    if(domain && seenDomains.has(domain))duplicateInFile=true;
    if(duplicateInFile)errors.push('Duplicate within CSV');
    if(number)seenNumbers.add(number);
    if(domain)seenDomains.add(domain);
    candidates.push({row:i+1,number,domain,errors,duplicateInFile});
  }
  // Read-only checks; no staging, production, customer or membership changes.
  if(seenNumbers.size) {
    const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations')
      .select('company_number').in('company_number',[...seenNumbers]);
    if(error)return crmResponse(503,{error:'Company number duplicate check unavailable.'});
    for(const item of data??[])if(item.company_number)
      existingNumbers.add(String(item.company_number).replace(/\s/g,'').toUpperCase());
  }
  if(seenDomains.size) {
    const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations')
      .select('website_domain').in('website_domain',[...seenDomains]);
    if(error)return crmResponse(503,{error:'Website domain duplicate check unavailable.'});
    for(const item of data??[])if(item.website_domain)
      existingDomains.add(String(item.website_domain).toLowerCase());
  }
  const rows:ReviewRow[]=candidates.map(c=>{
    const alreadyExists=Boolean((c.number && existingNumbers.has(c.number)) ||
      (c.domain && existingDomains.has(c.domain)));
    const errors=[...c.errors];
    if(alreadyExists)errors.push('Organisation already in CRM');
    return {row:c.row,valid:errors.length===0,errors,duplicateInFile:c.duplicateInFile,alreadyExists};
  });
  return crmResponse(200,{
    dryRun:true,writes:0,rows,total:rows.length,valid:rows.filter(r=>r.valid).length,
    preview_sha256:createHash('sha256').update(csv,'utf8').digest('hex'),
  });
}
