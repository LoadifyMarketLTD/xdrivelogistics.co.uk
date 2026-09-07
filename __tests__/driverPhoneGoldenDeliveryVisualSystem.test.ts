import fs from 'node:fs';
import path from 'node:path';

describe('phone GOLDEN delivery-first visual system', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx'),
    'utf8',
  );

  it('uses the delivery-first shell across the application', () => {
    expect(source).toContain("topChrome: { backgroundColor: '#FFFFFF'");
    expect(source).toContain('borderTopLeftRadius: 28');
    expect(source).toContain("bodyViewport: { flex: 1, backgroundColor: '#F7F8FA'");
    expect(source).not.toContain('<ImageBackground');
  });

  it('uses the licensed delivery UI grammar for jobs and routes', () => {
    expect(source).toContain('function RouteBand');
    expect(source).toContain('style={styles.routeConnector}');
    expect(source).toContain("backgroundColor: '#E8F1FF'");
    expect(source).toContain("backgroundColor: '#FFF6BF'");
    expect(source).toContain('style={styles.workHero}');
  });
  it('keeps the whole driver surface on the same visual language', () => {
    for (const marker of [
      'function LoadCard',
      'function PostedLoadContext',
      'function OfferForm',
      'function OffersBody',
      'function HistoryCard',
      'function WorkRoute',
      'function ProgressBoard',
      'function PodPanel',
      'function AccountBody',
      'function AlertsFeed',
      'function NearbyWork',
      'function EarningsPanel',
      'function JourneysPanel',
    ]) expect(source).toContain(marker);
    expect(source).toContain('borderRadius: 999');
    expect(source).toContain('shadowOpacity: 0.08');
  });
});