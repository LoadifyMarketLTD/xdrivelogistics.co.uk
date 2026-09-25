import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const intelligenceApi = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/operations-intelligence/route.ts'), 'utf8');
const intelligenceHook = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/useOperationsIntelligence.ts'), 'utf8');

describe('CX Diary commercial density and execution milestone parity', () => {
  it('batch-loads real company, vehicle, commercial agreement and tracking data', () => {
    expect(intelligenceApi).toContain("from('job_commercial_agreements')");
    expect(intelligenceApi).toContain("from('companies').select('id,name,phone')");
    expect(intelligenceApi).toContain("from('vehicles').select('id,reg_plate')");
    expect(intelligenceApi).toContain("from('job_tracking_events')");
    expect(intelligenceApi).toContain(".in('job_id', scopedJobIds)");
  });

  it('does not expose commercial rates to ordinary company members/drivers', () => {
    expect(intelligenceApi).toContain("const canViewCommercial = ['owner', 'admin', 'dispatcher'].includes");
    expect(intelligenceApi).toContain('const commercialVisible = canViewCommercial');
    expect(intelligenceApi).toContain('agreedRate: commercialVisible ?');
    expect(intelligenceApi).toContain('paymentTerms: commercialVisible ?');
  });

  it('surfaces confirmed CX-style booking facts inside the XDrive Diary design', () => {
    for (const label of ['Posted by', 'Booked to', 'Agreed rate', 'Payment terms', 'Received by:', 'Left at:', 'Delivered:', 'Driver notes:', 'Delivery notes:']) {
      expect(diary).toContain(label);
    }
    expect(diary).toContain('vehicleRegistration');
    expect(diary).toContain('counterpartyPhone');
  });

  it('projects canonical execution milestones from tracking events', () => {
    for (const event of ['on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'on_my_way_to_delivery', 'on_site_delivery', 'delivered']) {
      expect(diary).toContain(event);
    }
    expect(diary).toContain('intelligence.eventsByJob.get(job.id)');
    expect(intelligenceHook).toContain('eventsByJob');
  });
});
