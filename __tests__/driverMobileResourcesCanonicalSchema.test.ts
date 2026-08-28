import fs from 'node:fs';
import path from 'node:path';

describe('driver mobile resources canonical schema contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'),
    'utf8',
  );
  const client = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/api/resources.ts'),
    'utf8',
  );

  it('reads canonical driver identity columns only', () => {
    expect(source).toContain(".select('id,company_id,display_name,email,phone,status,app_access,driver_type,can_commercial_bid')");
    expect(source).not.toContain('display_name,full_name,name');
    expect(source).not.toContain('driver.full_name');
    expect(source).not.toContain('driver.name');
  });

  it('reads canonical vehicle and company identity columns only', () => {
    expect(source).toContain(".select('id,type,make,model,reg_plate')");
    expect(source).toContain(".select('id,name,company_number,company_type,status')");
    expect(source).not.toContain('vehicle_type,make,model,registration');
    expect(source).not.toContain('vehicle.registration');
    expect(source).not.toContain('vehicle.reg ||');
  });

  it('keeps resources behind the native driver boundary', () => {
    expect(source).toContain('const context = await requireDriver(request)');
    expect(source).toContain('if (!isDriverContext(context)) return context');
  });

  it('uses notification_events as the Expo operational alert authority', () => {
    expect(source).toContain(".from('notification_events')");
    expect(source).toContain(".select('id,event_type,entity_type,entity_id,payload,status,created_at,recipient_user_id,company_id')");
    expect(source).toContain('recipient_user_id.eq.${context.userId}');
    expect(source).toContain('recipient_user_id.is.null,company_id.eq.${context.companyId}');
    expect(source).toContain('alerts,');
    expect(client).toContain('alerts: DriverAlert[]');
  });

  it('returns the Expo profile contract while retaining legacy resources compatibility', () => {
    expect(source).toContain('name: displayName');
    expect(source).toContain('email,');
    expect(source).toContain('phone,');
    expect(source).toContain('driver,');
    expect(source).toContain('company,');
    expect(source).toContain('vehicle,');
    expect(source).toContain('quotes: []');
    expect(source).toContain('documents,');
    expect(source).toContain('invoices,');
    expect(source).toContain('profile: {');
    expect(source).toContain('notifications: notificationsResult.data ?? []');
  });
});
