import fs from 'node:fs';
import path from 'node:path';

describe('driver mobile resources canonical schema contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'),
    'utf8',
  );

  it('reads canonical driver identity columns only', () => {
    expect(source).toContain(".select('id,company_id,display_name,email,phone,status,app_access,driver_type,can_commercial_bid')");
    expect(source).not.toContain('display_name,full_name,name');
    expect(source).not.toContain('driver.full_name');
    expect(source).not.toContain('driver.name');
  });

  it('reads canonical vehicle identity columns only', () => {
    expect(source).toContain(".select('id,type,make,model,reg_plate')");
    expect(source).not.toContain('vehicle_type,make,model,registration');
    expect(source).not.toContain('vehicle.registration');
    expect(source).not.toContain('vehicle.reg ||');
  });

  it('keeps resources behind the native driver boundary', () => {
    expect(source).toContain('const context = await requireDriver(request)');
    expect(source).toContain('if (!isDriverContext(context)) return context');
  });
});
