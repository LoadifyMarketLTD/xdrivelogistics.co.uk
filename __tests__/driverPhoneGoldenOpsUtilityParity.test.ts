import fs from 'node:fs';
import path from 'node:path';

describe('phone GOLDEN XDrive operations utility parity', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx'),
    'utf8',
  );

  it('keeps operations search richer than a text-only lookup', () => {
    expect(appSource).toContain("const [radius, setRadius]");
    expect(appSource).toContain("const [vehicle, setVehicle]");
    expect(appSource).toContain("const [dateWindow, setDateWindow]");
    expect(appSource).toContain('PICKUP RADIUS');
    expect(appSource).toContain('COLLECTION WINDOW');
    expect(appSource).toContain('matchesCollectionWindow');
  });

  it('provides a dedicated privacy-safe nearby work surface', () => {
    expect(appSource).toContain("if (page === 'nearby') return <NearbyWork");
    expect(appSource).toContain('Closest collection opportunities');
    expect(appSource).toContain('distanceToPickupMiles');
    expect(appSource).toContain('does not expose other drivers or their live positions');
  });

  it('summarises invoice states without inventing payout capability', () => {
    expect(appSource).toContain('FINANCE CONTROL');
    expect(appSource).toContain('IN REVIEW');
    expect(appSource).toContain('AWAITING PAYMENT');
    expect(appSource).toContain('PAID');
    expect(appSource).toContain('No early-payment or payout feature is implied here.');
  });

  it('keeps Return IQ as XDrive destination-priority matching', () => {
    expect(appSource).toContain('RETURN IQ');
    expect(appSource).toContain('Journey matching');
    expect(appSource).toContain('destinationPriorityEnabled');
    expect(appSource).toContain('Return-work radius');
  });
});
