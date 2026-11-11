import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {documentSummary,documentIsApproved,driverDocumentStatus} from '../lib/companyDocumentAssessment';

const file=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const approved=(doc_type:string,expiry_date:string|null='2028-12-31')=>({doc_type,status:'approved',expiry_date});

describe('Fleet and Driver authentic document metadata',()=>{
 it('reads driver_documents for the authorised company in both approved tabs',()=>{
  const component=file('app/components/workspace/MemberFleetOverview.tsx');
  expect(component).toContain('includeDocuments=true');
  expect(component).not.toContain("includeDocuments=${section === 'fleet'}");
  const api=file('app/api/workspace/fleet-overview/route.ts');
  expect(api).toContain("from('driver_documents')");
  expect(api).toContain("from('vehicle_documents')");
  expect(api).toContain("eq('company_id', companyId)");
  expect(api).toContain("if (!membership) return respond(403");
  expect(api).toContain('is_available');
 });
 it('recognises approved driver licence without inventing CPC or ID verification',()=>{
  const docs=[approved('Driving Licence'),approved('Hire & Reward'),approved('Insurance'),approved('Other')];
  expect(driverDocumentStatus(docs,'licence')).toBe('Approved');
  expect(driverDocumentStatus(docs,'cpc')).toBe('Not recorded');
  expect(driverDocumentStatus(docs,'identity')).toBe('Not recorded');
  expect(driverDocumentStatus(docs,'licence',true)).toBe('Restricted');
  expect(documentSummary(docs).approved).toBe(4);
 });
 it('treats expired, rejected, pending and unavailable documents conservatively',()=>{
  const expired=approved('Driving Licence','2020-01-01');
  expect(documentIsApproved(expired)).toBe(false);
  expect(driverDocumentStatus([expired],'licence')).toBe('Action required');
  expect(documentSummary([expired]).needsAction).toBe(1);
  expect(driverDocumentStatus([{...expired,status:'pending',expiry_date:null}],'licence')).toBe('Pending review');
  expect(documentSummary([],true).label).toBe('Not available');
  expect(documentSummary([]).label).toBe('No document records');
 });
 it('uses document records in the approved 3150 Fleet and Drivers visual components',()=>{
  const driver=file('app/try-xdrive-demo/components/DemoDriversBoard.tsx');
  const fleet=file('app/try-xdrive-demo/components/DemoFleetBoard.tsx');
  expect(driver).toContain('documentSummary(docs');
  expect(driver).toContain('driverDocumentStatus(');
  expect(driver).not.toContain('<span>Licence: Not verified</span>');
  expect(fleet).toContain('documentSummary(sourceDocuments.filter(');
  expect(fleet).toContain('vehicle.is_available === true');
  expect(fleet).not.toContain("compliance: 'Not verified'");
 });
});
