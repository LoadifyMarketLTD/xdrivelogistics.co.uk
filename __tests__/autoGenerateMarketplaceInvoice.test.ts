import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../app/api/_lib/platformFlags', () => ({
  getFeatureFlag: mocks.getFeatureFlag,
}));

import { autoGenerateMarketplaceInvoice } from '../app/api/_lib/autoGenerateMarketplaceInvoice';

describe('autoGenerateMarketplaceInvoice', () => {
  beforeEach(() => {
    mocks.getFeatureFlag.mockReset();
    mocks.from.mockReset();
    mocks.rpc.mockReset();
  });

  it('returns an explicit disabled result and does not query invoices when invoice generation is disabled', async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);

    const result = await autoGenerateMarketplaceInvoice({
      supabase: {
        from: mocks.from,
        rpc: mocks.rpc,
      } as never,
      jobId: 'job-1',
      supplierCompanyId: 'company-1',
      actorUserId: 'user-1',
      idempotencyKey: 'auto-pod-job-1',
    });

    expect(result).toEqual({
      created: false,
      invoiceId: null,
      reason: 'Invoice generation is currently disabled.',
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
