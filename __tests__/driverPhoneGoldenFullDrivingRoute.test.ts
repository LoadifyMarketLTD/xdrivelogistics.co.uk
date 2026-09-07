import fs from 'node:fs';
import path from 'node:path';

describe('phone GOLDEN full driving route contract', () => {
  const appSource = fs.readFileSync(path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx'), 'utf8');
  const locationSource = fs.readFileSync(path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/tracking/nativeLocation.ts'), 'utf8');

  it('opens the internal Route screen from Work Order Overview', () => {
    expect(appSource).toContain("onOpenRoute={() => setDetailTab('route')}");
    expect(appSource).toContain("route.kind === 'job' && detailTab !== 'overview' ? setDetailTab('overview')");
    expect(appSource).not.toContain('onMap={() => void openExternalRoute(jobDetail)}');
  });

  it('renders a full ordered multi-stop map and route list', () => {
    expect(appSource).toContain("import { WebView } from 'react-native-webview';");
    expect(appSource).toContain('function fullDrivingRouteUrl');
    expect(appSource).toContain("params.set('waypoints', waypoints.join('|'))");
    expect(appSource).toContain('function embeddedDrivingRouteUrl');
    expect(appSource).toContain("output: 'embed'");
    expect(appSource).toContain('<WebView source={{ uri: embeddedRouteUrl }}');
    expect(appSource).not.toContain('<WebView source={{ uri: routeUrl }}');
    expect(appSource).toContain('FULL DRIVING ROUTE');
    expect(appSource).toContain('NEXT ACTIVE STOP');
  });

  it('uses current location locally without changing job status', () => {
    expect(locationSource).toContain('export async function getCurrentDriverPosition()');
    expect(locationSource).toContain('Opening the route does not change job status.');
    const routeStart = appSource.indexOf('function WorkRoute');
    const routeEnd = appSource.indexOf('function ProgressBoard', routeStart);
    const routeBlock = appSource.slice(routeStart, routeEnd);
    expect(routeBlock).not.toContain('postJobStatus');
    expect(routeBlock).not.toContain('lifecycleAction');
  });

  it('hides zero or incomplete cargo dimensions instead of rendering false values', () => {
    expect(appSource).toContain('dimensionValues.every((value) => Number.isFinite(value) && value > 0)');
    expect(appSource).not.toContain('const dimensions = [numberText(cargo.lengthCm)');
  });

  it('keeps navigation explicit and separate from opening the route', () => {
    expect(appSource).toContain('Start navigation');
    expect(appSource).toContain("dir_action: 'navigate'");
    expect(appSource).toContain('Open full route in Maps');
  });
});
