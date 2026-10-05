import { describe, expect, it } from 'vitest';
import { deriveOperationalActionCentreItems } from '../lib/actionCentreOperational';

const now = new Date('2026-10-05T12:00:00.000Z');

describe('operational Action Centre derivation', () => {
  it('surfaces carrier allocation, POD, invoice-ready and overdue invoice actions', () => {
    const items = deriveOperationalActionCentreItems({
      role: 'admin',
      companyId: 'carrier-1',
      now,
      jobs: [
        { id: 'job-awarded', status: 'awarded', awarded_carrier_company_id: 'carrier-1', created_at: '2026-09-01T00:00:00.000Z' },
        { id: 'job-pod', status: 'delivered', awarded_carrier_company_id: 'carrier-1', assigned_driver_id: 'driver-1', vehicle_id: 'vehicle-1', pod_generated: false, delivered_at: '2026-10-04T10:00:00.000Z' },
        { id: 'job-invoice', status: 'completed', awarded_carrier_company_id: 'carrier-1', assigned_driver_id: 'driver-1', vehicle_id: 'vehicle-1', pod_generated: true, completed_at: '2026-10-04T11:00:00.000Z' },
      ],
      bids: [],
      invoices: [{ id: 'inv-overdue', supplier_company_id: 'carrier-1', payment_status: 'unpaid', due_date: '2026-10-01', created_at: '2026-09-15T00:00:00.000Z' }],
    });
    expect(items.map((item) => item.event_type)).toEqual(expect.arrayContaining([
      'driver_allocation_required',
      'pod_completion_required',
      'invoice_ready',
      'invoice_overdue',
    ]));
    expect(items.every((item) => item.persistent)).toBe(true);
  });

  it('surfaces quote decisions to Broker and Customer without crossing company scope', () => {
    const jobs = [
      { id: 'job-1', company_id: 'buyer-1', status: 'posted', created_at: '2026-10-01T00:00:00.000Z' },
      { id: 'job-2', company_id: 'buyer-2', status: 'posted', created_at: '2026-10-01T00:00:00.000Z' },
    ];
    const bids = [
      { id: 'bid-1', job_id: 'job-1', status: 'submitted' },
      { id: 'bid-2', job_id: 'job-2', status: 'submitted' },
    ];
    const broker = deriveOperationalActionCentreItems({ role: 'broker', companyId: 'buyer-1', jobs, bids, invoices: [], now });
    const customer = deriveOperationalActionCentreItems({ role: 'customer', companyId: 'buyer-1', jobs, bids, invoices: [], now });
    expect(broker).toHaveLength(1);
    expect(broker[0]?.cta_href).toBe('/broker/bids');
    expect(customer).toHaveLength(1);
    expect(customer[0]?.cta_href).toBe('/customer/quotes');
  });

  it('keeps assigned driver actions alive until the execution step is completed', () => {
    const items = deriveOperationalActionCentreItems({
      role: 'driver',
      driverId: 'driver-1',
      companyId: 'carrier-1',
      jobs: [
        { id: 'job-old', status: 'allocated', assigned_driver_id: 'driver-1', created_at: '2026-08-01T00:00:00.000Z' },
        { id: 'job-pod', status: 'delivered', assigned_driver_id: 'driver-1', pod_generated: false, delivered_at: '2026-10-05T09:00:00.000Z' },
        { id: 'job-done', status: 'completed', assigned_driver_id: 'driver-1', pod_generated: true, completed_at: '2026-10-05T10:00:00.000Z' },
      ],
      bids: [],
      invoices: [],
      now,
    });
    expect(items.map((item) => item.event_type)).toEqual(expect.arrayContaining(['driver_acceptance_required','complete_pod']));
    expect(items.some((item) => item.event_id === 'job-done')).toBe(false);
    expect(items.find((item) => item.event_id === 'job-old')?.persistent).toBe(true);
  });
});
