import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Company Marketplace Freight Radar', () => {
  const marketplace = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const radar = read('app/components/workspace/MarketplaceLoadMap.tsx');
  const css = read('app/components/workspace/MarketplaceLoadMap.css');
  const api = read('app/api/marketplace/company/route.ts');

  it('maps the same visible search results by public pickup outcode', () => {
    expect(marketplace).toContain('pickupPostcode: load.pickup_postcode');
    expect(marketplace).toContain('postedAt: load.exchange_posted_at');
    expect(radar).toContain('api.postcodes.io/outcodes');
    expect(radar).toContain('publicOutcodeFor');
    expect(radar).toContain('Pre-award radar uses public postcode/outcode centroids only');
  });

  it('does not consume exact pre-award pickup coordinates even if a legacy field is supplied', () => {
    expect(radar).toContain('Legacy field is accepted but intentionally ignored pre-award');
    expect(radar).not.toContain('load.pickupCoordinates!');
    expect(api).toContain('pickupCoordinates: null');
    expect(api).toContain('deliveryCoordinates: null');
  });

  it('clusters loads and exposes contextual Details / Quote Now from the selected area', () => {
    expect(radar).toContain('RadarCluster');
    expect(radar).toContain('selectedClusterKey');
    expect(radar).toContain('multiple loads in this public pickup area');
    expect(radar).toContain('Quote Now');
    expect(radar).toContain('Details');
    expect(marketplace).toContain('onQuote={(loadId)');
    expect(marketplace).toContain('onDetails={(loadId)');
  });

  it('shows freshness using the existing exchange posted timestamp', () => {
    expect(radar).toContain('ageMinutes(load.postedAt)');
    expect(radar).toContain('freshest <= 10');
    expect(marketplace).toContain('postedAt: load.exchange_posted_at');
  });

  it('uses the measured XDrive workspace geometry', () => {
    expect(css).toContain('var(--ws-tab-h, 28px)');
    expect(css).toContain('var(--ws-panel-head-h, 36px)');
    expect(css).toContain('var(--ws-table-row-h, 42px)');
    expect(css).toContain('var(--ws-radius, 4px)');
  });

  it('does not couple Radar to Super Admin', () => {
    expect(marketplace).not.toContain('/super-admin');
    expect(radar).not.toContain('/super-admin');
    expect(api).not.toContain('/super-admin');
  });
});
