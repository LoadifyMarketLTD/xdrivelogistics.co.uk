import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('customer 3150 detailed job owner access', () => {
  const board = readFileSync('app/try-xdrive-demo/components/DemoExchangeBoard.tsx', 'utf8');
  const helper = readFileSync('app/try-xdrive-demo/components/useCustomerSecureLoadDetails.ts', 'utf8');

  it('fetches only authenticated server-authorised job sheet for production customer', () => {
    expect(board).toContain('useCustomerSecureLoadDetails(details,productionMode&&role==="Customer")');
    expect(helper).toContain('supabase.auth.getSession()');
    expect(helper).toContain('/api/workspace/jobs/');
    expect(helper).toContain('/sheet');
    expect(helper).toContain("Authorization: 'Bearer ' + token");
    expect(helper).toContain("cache: 'no-store'");
  });
  it('only renders owner-authorised private stop contacts, retaining reference privacy', () => {
    expect(board).toContain('formatAuthorisedStop(secureDetails.data?.route?.pickup)');
    expect(board).toContain('formatAuthorisedStop(secureDetails.data?.route?.delivery)');
    expect(board).toContain('secureDetails.data?.ownerCompany?.memberId');
    expect(board).toContain('Visible only to authorised parties after award');
    expect(helper).toContain('if (!response.ok) throw');
  });
});
