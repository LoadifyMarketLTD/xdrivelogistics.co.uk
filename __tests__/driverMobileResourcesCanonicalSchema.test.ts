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

  it('keeps authorization fail-closed at the native driver boundary', () => {
    expect(source).toContain('const context = await requireDriver(request)');
    expect(source).toContain('if (!isDriverContext(context)) return context');
    expect(source).toContain("return NextResponse.json({ error: driverResult.error?.message ?? 'Driver profile was not found.' }, { status: 500 })");
  });

  it('does not turn peripheral resource outages into false driver access denial', () => {
    expect(source).toContain('const partialResources = [');
    expect(source).toContain("vehicleResult.error ? 'vehicle' : null");
    expect(source).toContain("alertsResult.error ? 'alerts' : null");
    expect(source).toContain("if (invoiceResult.error) partialResources.push('invoices')");
    expect(source).toContain('partial: partialResources');
    expect(source).not.toContain('const firstError = driverDocsResult.error');
    expect(source).not.toContain('if (vehicleResult.error) return NextResponse.json');
    expect(source).not.toContain('if (companyResult.error) return NextResponse.json');
  });

  it('uses notification_events as the Expo operational alert authority', () => {
    expect(source).toContain(".from('notification_events')");
    expect(source).toContain(".select('id,event_type,entity_type,entity_id,payload,status,created_at,recipient_user_id,company_id')");
    expect(source).toContain('recipient_user_id.eq.${context.userId}');
    expect(source).toContain('recipient_user_id.is.null,company_id.eq.${context.companyId}');
    expect(source).toContain('alerts,');
    expect(source).toContain("const alerts = !alertsResult.error");
    expect(client).toContain('alerts: DriverAlert[]');
  });

  it('keeps the compatibility Return Journey resource on the canonical PR #357 schema', () => {
    expect(source).toContain(".select('id,from_postcode,to_postcode,available_from,available_to,vehicle_type,notes,status')");
    expect(source).toContain('from_location: canonicalJourney.from_postcode ?? null');
    expect(source).toContain('to_location: canonicalJourney.to_postcode ?? null');
    expect(source).toContain('available_date: canonicalJourney.available_from ?? null');
    expect(source).not.toContain(".select('id,from_location,to_location,available_date')");
    expect(source).not.toContain("rpc('replace_driver_return_journey'");
    expect(source).toContain('from_postcode: fromPostcode');
    expect(source).toContain("status: 'available'");
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
    expect(source).toContain('notifications: notificationsResult.error ? [] : notificationsResult.data ?? []');
  });
});
