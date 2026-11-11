import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard page 5', () => {
  it('uses an isolated in-transit component for persisted in_transit state', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain("approvedScreen.number===5 && currentStatus==='in_transit'");
    expect(source).toContain('<InTransitDeliveryStep');
    expect(source).toContain("onNext={()=>void moveStatus('on_site_delivery')}");
  });

  it('publishes driver GPS through the existing authenticated location publisher', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    expect(source).toContain('useDriverLocationPublisher(job?.current_status ?? job?.status, mobilePwa && !podOnly');
  });

  it('shows miles/minutes only from live route metrics and has an honest fallback', () => {
    const page=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/InTransitDeliveryStep.tsx'),'utf8');
    expect(page).toContain('routeMetrics.durationMinutes');
    expect(page).toContain('routeMetrics.distanceMiles.toFixed(1)');
    expect(page).toContain('Live road estimate unavailable. Use Navigate for directions.');
    expect(page).toContain('<InTransitRouteMap origin={routeMetrics.origin} destination={routeMetrics.destination} geometry={routeMetrics.geometry??null}/>');
    expect(page).toContain('calculated driving route to delivery');
    expect(page).toContain('Route geometry is unavailable from the active routing provider.');
    expect(page).not.toContain('38 min');
    expect(page).not.toContain('24.1 mi');
  });

  it('calculates the route from a recent persisted driver location to delivery coordinates', () => {
    const route=fs.readFileSync(path.join(process.cwd(),'app/api/driver/web/jobs/[id]/delivery-route/route.ts'),'utf8');
    expect(route).toContain(".from('driver_locations')");
    expect(route).toContain(".eq('job_id',jobId)");
    expect(route).toContain('Date.now()-recordedMs>5*60*1000');
    expect(route).toContain('calculateDrivingRoute([');
    expect(route).toContain("reason:'driver_location_stale'");
    expect(route).toContain('origin:{lat:currentLat,lng:currentLng}');
    expect(route).toContain('destination:{lat:deliveryLat,lng:deliveryLng}');
    expect(route).toContain('geometry:metrics.geometry??null');
    const map=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/InTransitRouteMap.tsx'),'utf8');
    expect(map).toContain('L.polyline');
    expect(map).toContain('geometry?.length');
  });
});
