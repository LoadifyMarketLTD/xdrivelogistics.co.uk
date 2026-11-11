import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import Master3150OperationsKpis from '../app/components/workspace/Master3150OperationsKpis';

const rows = [
  { status:'posted',current_status:'posted',assigned_driver_id:null },
  { status:'awarded',current_status:'awarded',awarded_carrier_company_id:'carrier',assigned_driver_id:null },
  { status:'completed',current_status:'completed',assigned_driver_id:'driver',pod_generated:true },
  { status:'cancelled',current_status:'cancelled',awarded_carrier_company_id:'carrier',assigned_driver_id:null },
  { status:'expired',current_status:'expired',assigned_driver_id:null },
];

describe('3150 operational KPI parity with actual Diary booking eligibility', () => {
  it('counts awarded, completed and cancelled awarded bookings, excluding posted loads', () => {
    const html=renderToStaticMarkup(<Master3150OperationsKpis jobs={rows} view="diary"/>);
    expect(html).toContain('Total Bookings');
    expect(html).toMatch(/Total Bookings<\/strong><b>3<\/b>/);
    expect(html).toContain('All statuses');
    expect(html).not.toContain('Open for Quotes');
  });
  it('does not count delivery photos as a completed POD', () => {
    const html=renderToStaticMarkup(<Master3150OperationsKpis jobs={[{status:'delivered',pod_generated:false,delivery_photos:['staged-photo.jpg']}]} view="diary"/>);
    expect(html).toMatch(/Awaiting POD<\/strong><b>1<\/b>/);
  });
  it('keeps Bookings KPI total coherent with Diary while excluding cancelled from active work', () => {
    const html=renderToStaticMarkup(<Master3150OperationsKpis jobs={rows} view="bookings"/>);
    expect(html).toMatch(/Total Bookings<\/strong><b>3<\/b>/);
    expect(html).toMatch(/Pending Allocation<\/strong><b>1<\/b>/);
    expect(html).toMatch(/Completed<\/strong><b>1<\/b>/);
  });
});
