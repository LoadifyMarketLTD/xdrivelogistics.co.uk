'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useCompanyWorkspaceData} from './useCompanyWorkspaceData';
import {ActionButton,AlertBanner,PageFrame,PageHeader,Panel} from './WorkspaceUI';
import {downloadXlsx} from '../../../lib/spreadsheetExport';
import {deriveCompanyReports,makeReportSheets,reportCell,reportPeriod,reportSections,type ReportSection} from './companyAdminReportsModel';
import {validDiaryDate} from './companyAdminDiaryFilters';

export default function CompanyAdminReports(){
 const data=useCompanyWorkspaceData();
 const [section,setSection]=useState<ReportSection>('Overview');
 const [preset,setPreset]=useState('30');
 const [period,setPeriod]=useState(()=>reportPeriod('30'));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const valid=(!period.from||validDiaryDate(period.from))&&(!period.to||validDiaryDate(period.to))&&(!period.from||!period.to||period.from<=period.to);
 const report=useMemo(()=>deriveCompanyReports(data,period),[data,period]);
 const chosen=report.tables.find(t=>t.name===section);
 const full=makeReportSheets(report,'Full',period);
 const partial=report.tables.some(t=>!t.verified);
 async function exportWorkbook(which:ReportSection|'Full'){
  if(!valid||busy||data.loading)return;
  const sheets=makeReportSheets(report,which,period);if(!sheets.some(s=>s.name!=='Summary'))return;
  setBusy(true);setError('');
  try{await downloadXlsx('xdrive-company-'+which.toLowerCase()+'-report.xlsx',sheets)}catch{setError('The Excel export could not be generated. Please retry.')}finally{setBusy(false)}
 }
 const money=(value:number,currency:string)=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(value);
 return <PageFrame><PageHeader eyebrow="Company intelligence" title="Reports & Statistics" description="Operational activity and recorded financial evidence for this company. Periods use UK calendar dates; lifecycle states and fleet availability reflect current records."/>
 {data.error&&<AlertBanner tone="warning">{data.error}</AlertBanner>}
 {error&&<AlertBanner tone="danger">{error}</AlertBanner>}
 {partial&&<AlertBanner tone="warning">Some datasets are unavailable or incomplete. Unverified totals and worksheets are withheld; the workbook summary records coverage.</AlertBanner>}
 <section className="company-admin-report-controls" aria-label="Report controls">
 <label>Reporting period<select aria-label="Reporting period" value={preset} onChange={e=>{const v=e.target.value;setPreset(v);if(v!=='custom')setPeriod(reportPeriod(v))}}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All available records</option><option value="custom">Custom period</option></select></label>
 <label>From<input type="date" value={period.from} onChange={e=>{setPreset('custom');setPeriod(p=>({...p,from:e.target.value}))}}/></label><label>To<input type="date" value={period.to} onChange={e=>{setPreset('custom');setPeriod(p=>({...p,to:e.target.value}))}}/></label>
 <ActionButton tone="secondary" disabled={data.loading||busy} onClick={()=>void data.refresh()}>Refresh</ActionButton>
 <ActionButton tone="secondary" disabled={!valid||busy||data.loading||full.length<=1} onClick={()=>void exportWorkbook('Full')}>{busy?'Exporting…':'Export Full Workbook'}</ActionButton>
 </section>
 {!valid&&<AlertBanner tone="danger">Enter a valid reporting range. From must not be after To.</AlertBanner>}
 <div className="company-admin-report-metrics">{report.tables.map(t=><button key={t.name} type="button" onClick={()=>setSection(t.name)}><span>{t.name==='Drivers'||t.name==='Vehicles'?t.name+' (current)':t.name}</span><strong>{valid&&t.verified?t.rows.length:'Unavailable'}</strong><small>{t.verified?'Company records':'Data incomplete'}</small></button>)}</div>
 <nav role="tablist" className="workspace-tab-strip company-admin-report-tabs" aria-label="Report categories">{reportSections.map(t=><button key={t} role="tab" type="button" aria-selected={section===t} data-active={section===t?'true':'false'} onClick={()=>setSection(t)}>{t}</button>)}</nav>
 {valid&&(section==='Overview'?<div className="company-admin-report-grid">
 <Panel title="Load lifecycle" description="Own non-draft loads created during the selected period."><div className="company-admin-report-bars">{report.statuses.map(r=><div key={r.label}><span>{r.label.replaceAll('_',' ')}</span><progress max={Math.max(1,report.statuses.reduce((n,v)=>n+v.count,0))} value={r.count}/><b>{r.count}</b></div>)}</div>{!report.statuses.length&&<p>No verified load activity for this period.</p>}</Panel>
 <Panel title="Commercial evidence" description="Issued invoice gross values by currency and commercial direction. Credit notes, void, draft and refunded records excluded from these gross totals."><p>Issued records: {report.issuedCount??'Unavailable'}</p>{report.financial.map(r=><p key={r.direction+r.currency}><strong>{r.direction==='receivable'?'Receivable':'Payable'} · {r.currency}</strong> — {money(r.gross,r.currency)} ({r.count})</p>)}{!!report.missingFinancial&&<p>{report.missingFinancial} issued records excluded from monetary totals because amount or currency is missing.</p>}<p>Gross is not cash received or outstanding balance. <Link href="/admin/finance/statements">Open finance statements</Link></p></Panel>
 <Panel title="Top routes" description="Own loads by recorded collection and delivery location.">{report.routes.map(r=><p key={r.label}>{r.label} <strong>{r.count}</strong></p>)}{!report.routes.length&&<p>No verified routes.</p>}</Panel>
 <Panel title="Vehicle demand" description="Requested vehicle types on own loads.">{report.vehicleTypes.map(r=><p key={r.label}>{r.label.replaceAll('_',' ')} <strong>{r.count}</strong></p>)}{!report.vehicleTypes.length&&<p>No verified vehicle demand.</p>}</Panel>
 <Panel title="Execution performance" description="Bookings by scheduled collection date."><p>Completed: {report.completed??'Unavailable'}</p><p>On-time performance: not measured by this report.</p></Panel>
 <Panel title="Reporting coverage">{report.tables.map(t=><p key={t.name}><strong>{t.name}</strong> — {t.verified?'Available':'Unavailable / partial'}</p>)}</Panel>
 </div>:chosen&&<Panel title={chosen.name+' report'} description={chosen.basis} actions={<ActionButton tone="secondary" disabled={!chosen.verified||busy||data.loading} onClick={()=>void exportWorkbook(chosen.name)}>Export XLSX</ActionButton>}>{!chosen.verified?<p>Verified records unavailable. Refresh or review data access.</p>:<><p>{chosen.rows.length} records</p><div className="company-admin-report-table"><table><thead><tr>{chosen.columns.map(c=><th key={c.key}>{c.header}</th>)}</tr></thead><tbody>{chosen.rows.map((r,i)=><tr key={i}>{chosen.columns.map(c=><td key={c.key}>{reportCell(r[c.key])}</td>)}</tr>)}</tbody></table></div>{!chosen.rows.length&&<p>No records match this period.</p>}</>}</Panel>)}
 </PageFrame>
}
