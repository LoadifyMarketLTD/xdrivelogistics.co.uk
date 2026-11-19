import { describe, expect, it } from 'vitest';
import { composeCompanyAdminSidebarNav } from '../app/components/workspace/companyAdminSidebarNav';
import { deriveCompanyOperationalOverview, companyJobReference } from '../app/components/workspace/companyOperationalOverview';
import type { WorkspaceNavGroup } from '../lib/workspaceRole';
import type { WorkspaceJob, WorkspaceBid, WorkspaceDriver, WorkspaceInvoice } from '../app/components/workspace/useCompanyWorkspaceData';

const group=(paths:Array<[string,string]>):WorkspaceNavGroup=>({id:'allowed',label:'Allowed',items:paths.map(([label,href],i)=>({id:String(i),label,href}))});
describe('Company Admin 3150 navigation adapter',()=>{
  it('retains the approved order, all authorized unique routes and no unauthorized items',()=>{
    const groups=[group([['Directory','/admin/marketplace/directory'],['Reports & Data','/admin/finance/reports'],['Dashboard','/admin'],['Marketplace','/admin/marketplace'],['Bulk Import','/admin/bulk-import'],['Documents','/admin/documents'],['Finance','/admin/invoices'],['Team','/admin/team'],['Post Load','/admin/post-load']]),group([['Marketplace','/admin/marketplace']])];
    const nav=composeCompanyAdminSidebarNav(groups);
    expect(nav.map(g=>g.label)).toEqual(['Dashboard','Post Load','Loads','Invoices','Network & Tools','Directory','Reports','More']);
    expect(nav.flatMap(g=>g.items.map(i=>i.href)).sort()).toEqual([...new Set(groups.flatMap(g=>g.items.map(i=>i.href)))].sort());
    expect(nav.flatMap(g=>g.items).some(i=>i.href==='/admin/drivers')).toBe(false);
  });
  it('does not manufacture routes without authorization',()=>expect(composeCompanyAdminSidebarNav([])).toEqual([]));
});

const now=new Date('2026-11-19T13:00:00Z');
const job=(id:string,status:string,extra:Partial<WorkspaceJob>={}):WorkspaceJob=>({id,company_id:'company',status,pickup_location:'A',delivery_location:'B',pickup_datetime:'2026-11-19T09:00:00Z',delivery_datetime:'2026-11-19T12:00:00Z',vehicle_type:'Luton',created_at:'2026-11-18T10:00:00Z',updated_at:'2026-11-19T12:00:00Z',...extra});
const bid=(jobId:string,companyId:string,status:string,extra:Partial<WorkspaceBid>={}):WorkspaceBid=>({id:jobId+companyId,job_id:jobId,company_id:companyId,status,amount:100,bid_price_gbp:100,created_at:'2026-11-18T10:00:00Z',...extra});
const driver=(id:string,status:string,availability_status:string):WorkspaceDriver=>({id,display_name:id,status,availability_status});
const invoice=(id:string,extra:Partial<WorkspaceInvoice>):WorkspaceInvoice=>({id,status:'sent',amount:100,created_at:'2026-11-18T10:00:00Z',...extra});
describe('Company Admin real-data operational overview',()=>{
  it('keeps canonical ownership, execution, POD, quote and finance boundaries',()=>{
    const data={companyId:'company',jobs:[
      job('posted','posted'),job('awarded','awarded',{company_id:'customer',awarded_carrier_company_id:'company'}),job('active','in_transit',{company_id:'customer',awarded_carrier_company_id:'company',assigned_driver_id:'d1',vehicle_id:'v1'}),
      job('delivered','delivered',{awarded_carrier_company_id:'company',pod_required:true}),job('not-required','delivered',{awarded_carrier_company_id:'company',pod_required:false}),
      job('foreign','posted',{company_id:'other'}),job('draft','draft'),job('other-carrier','in_transit',{company_id:'customer',awarded_carrier_company_id:'other'}),
    ],bids:[bid('posted','supplier','submitted'),bid('posted','other','withdrawn'),bid('foreign','supplier','submitted'),bid('posted','company','submitted')],drivers:[driver('d1','active','available'),driver('d2','inactive','available'),driver('d3','active','busy'),driver('d4','active','available')],vehicles:[],invoices:[invoice('receivable',{supplier_company_id:'company',buyer_company_id:'customer'}),invoice('payable',{supplier_company_id:'other',buyer_company_id:'company'}),invoice('paid',{supplier_company_id:'company',payment_status:'paid'}),invoice('draft',{supplier_company_id:'company',status:'draft'})]};
    const result=deriveCompanyOperationalOverview(data,now);
    expect(result.openLoads.map(j=>j.id)).toEqual(['posted']);
    expect(result.active.map(j=>j.id)).toEqual(['active']);
    expect(result.unallocated.map(j=>j.id)).toEqual(['awarded']);
    expect(result.pod.map(j=>j.id)).toEqual(['delivered']);
    expect(result.availableDrivers.map(d=>d.id)).toEqual(['d4']);
    expect(result.overdue.map(j=>j.id)).toEqual(['active']);
    expect(result.receivedQuotes).toHaveLength(1);
    expect(result.quotesToReview.map(j=>j.id)).toEqual(['posted']);
    expect(result.receivables.map(i=>i.id)).toEqual(['receivable']);
    expect(result.todayJobs.some(j=>j.id==='foreign')).toBe(false);
    expect(result.recent.some(j=>j.id==='other-carrier')).toBe(false);
    expect(deriveCompanyOperationalOverview({...data,companyId:null},now).recent).toEqual([]);
  });
  it('preserves established commercial reference',()=>expect(companyJobReference(job('id','posted',{booking_reference:'XD-123',load_reference:'legacy'}))).toBe('XD-123'));
});
