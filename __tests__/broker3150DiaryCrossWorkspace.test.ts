import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Broker3150DiaryHeader, Broker3150DiaryTabs } from '../app/components/workspace/Broker3150DiaryChrome';

const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const states=['all','unallocated','allocated','in_progress','completed','cancelled','expired','awaiting_feedback','recent_feedback'];

describe('Broker 3150 Diary — shared visual source across real workspaces',()=>{
  it('renders approved header and date navigation with no demo records',()=>{
    const html=renderToStaticMarkup(React.createElement(Broker3150DiaryHeader,{date:'2026-11-08',onDateChange:()=>{}}));
    expect(html).toContain('Bookings &amp; Operations Schedule');
    expect(html).toContain('Previous day');
    expect(html).toContain('Selected diary date');
    expect(html).toContain('Today');
    expect(html).toContain('All dates');
    expect(html).toContain('xd3150-diary-header');
  });
  it('renders nine genuine status tabs and the active state and live counts',()=>{
    const tabs=states.map((id,index)=>({id,label:id,count:index}));
    const html=renderToStaticMarkup(React.createElement(Broker3150DiaryTabs,{tabs,selected:'completed',onSelect:()=>{},label:'Diary states'}));
    expect((html.match(/role="tab"/g)||[]).length).toBe(9);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('completed');
    expect(html).toContain('>8</span>');
  });
  it('preserves Broker source and adopts its exact shared chrome in Admin, Customer and Driver',()=>{
    const original=read('app/broker/diary/page.tsx');
    expect(original).toContain('xd3150-diary-status-tabs');
    expect(original).toContain('xd3150-diary-header');
    for(const file of ['app/components/workspace/OperationsDiaryPage.tsx','app/customer/diary/page.tsx','app/driver/history/page.tsx']){
      const content=read(file);
      expect(content,file).toContain('Broker3150DiaryHeader');
      expect(content,file).toContain('Broker3150DiaryTabs');
      expect(content,file).toContain('data-diary-source="broker-3150"');
    }
  });
  it('retains existing authenticated operational actions and dialogs',()=>{
    const admin=read('app/components/workspace/OperationsDiaryPage.tsx');
    expect(admin).toContain('CompanyJobSheetPanel');
    expect(admin).toContain('canManageDiaryGroups');
    expect(admin).toContain('CxDiaryActions');
    const customer=read('app/customer/diary/page.tsx');
    expect(customer).toContain('CompanyFeedbackDialog');
    expect(customer).toContain('CxDiaryActions');
    const driver=read('app/driver/history/page.tsx');
    expect(driver).toContain('CompanyJobSheetPanel');
    expect(driver).toContain('CxDiaryActions');
    expect(driver).toContain('ApprovedDriverDiaryCard');
    expect(driver).not.toContain('DemoBookingOverview');
  });
});