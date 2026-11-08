import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {hasCompletePodEvidence,isDeliveredAwaitingPod} from '../lib/jobs/podCompletion';

const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const valid={
  status:'delivered',current_status:'delivered',pod_generated:true,
  delivery_photos:['company/job/delivery/photo.jpg'],pod_photos:[],
  delivery_signature_data:'company/job/signature.png',client_signature_name:'Recipient'
};
describe('Canonical Awaiting POD truth across XDrive workspaces',()=>{
 it('recognises a delivered job with missing POD generation even if photographs exist',()=>{
  expect(isDeliveredAwaitingPod({...valid,pod_generated:false})).toBe(true);
  expect(hasCompletePodEvidence({...valid,pod_generated:false})).toBe(false);
 });
 it('recognises signature, recipient name and evidence omissions and excludes completed PODs',()=>{
  expect(isDeliveredAwaitingPod({...valid,delivery_signature_data:null})).toBe(true);
  expect(isDeliveredAwaitingPod({...valid,client_signature_name:''})).toBe(true);
  expect(isDeliveredAwaitingPod({...valid,delivery_photos:[],pod_photos:[]})).toBe(true);
  expect(isDeliveredAwaitingPod(valid)).toBe(false);
  expect(isDeliveredAwaitingPod({...valid,status:'cancelled',current_status:'cancelled'})).toBe(false);
  expect(isDeliveredAwaitingPod({...valid,status:'loaded',current_status:'loaded'})).toBe(false);
 });
 it('Bookings and Diary consume one shared POD backlog formula',()=>{
  const bookings=read('app/driver/jobs/page.tsx');
  const diary=read('app/driver/history/page.tsx');
  expect(bookings).toContain('jobs.filter(isDeliveredAwaitingPod).length');
  expect(diary).toContain('jobs.filter(isDeliveredAwaitingPod).length');
  expect(bookings).toContain('const hasPod = hasCompletePodEvidence(job);');
  for(const field of ['pod_generated','pod_photos','delivery_signature_data','client_signature_name']){
    expect(bookings).toContain(`  '${field}',`);
  }
  expect(bookings).not.toContain("effectiveStatus(job) === 'delivered' && (!job.delivery_photos");
 });
 it('Both company and Owner Driver 3150 dashboards consume full evidence completeness',()=>{
  expect(read('app/driver/_components/OwnerDriver3150LiveDashboard.tsx')).toContain('const pod = hasCompletePodEvidence(job);');
  expect(read('app/components/workspace/CompanyMasterDashboard.tsx')).toContain('const pod=hasCompletePodEvidence(job);');
 });
 it('prioritises active and incomplete POD bookings instead of cancelled history',()=>{
  const bookings=read('app/driver/jobs/page.tsx');
  expect(bookings).toContain("{ id: 'current', label: 'Current' }");
  expect(bookings).toContain("useState<DriverBookingView>('current')");
  expect(bookings).toContain("isDeliveredAwaitingPod(job)");
  expect(bookings).toContain("driverJobStage(job)==='in_progress'?0");
  expect(bookings).toContain("stage === 'cancelled' ? 'Cancelled booking'");
 });
 it('does not modify the protected Post Load form, route or schema',()=>{
  const form=read('app/admin/post-load/page.tsx');
  expect(form).toContain('<LoadPostingForm mode="admin" />');
 });
});
