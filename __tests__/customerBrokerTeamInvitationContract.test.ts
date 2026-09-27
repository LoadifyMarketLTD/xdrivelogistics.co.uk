import fs from 'node:fs';
import path from 'node:path';

const route = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/team/route.ts'), 'utf8');
const customer = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CustomerTeamPage.tsx'), 'utf8');
const broker = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/BrokerTeamPage.tsx'), 'utf8');

describe('Customer/Broker team invitation contract', () => {
  it('sends a real auth email and binds the membership to the resolved auth user', () => {
    expect(route).toContain('inviteUserByEmail(invitedEmail');
    expect(route).toContain('signInWithOtp({');
    expect(route).toContain("shouldCreateUser: false");
    expect(route).toContain("onConflict: 'company_id,user_id'");
    expect(route).not.toContain("onConflict: 'company_id,invited_email'");
    expect(route).toContain('user_id: targetUser.id');
  });

  it('preserves workspace identity and company isolation', () => {
    expect(route).toContain("workspace: z.enum(['customer', 'broker'])");
    expect(route).toContain("callerProfileRole !== workspace && callerProfileRole !== 'owner'");
    expect(route).toContain("existingActiveMembership.company_id !== companyId");
    expect(route).toContain("existingProfileRole && existingProfileRole !== targetProfileRole");
    expect(route).toContain(".eq('company_id', companyId)");
    expect(route).toContain("Department does not belong to this company.");
    expect(customer).toContain("workspace: 'customer'");
    expect(broker).toContain("workspace: 'broker'");
  });

  it('uses the live canonical disabled membership status instead of suspended', () => {
    expect(route).toContain("updatePayload.status = 'disabled'");
    expect(route).not.toContain("updatePayload.status = 'suspended'");
    expect(customer).toContain("membershipStatus: 'invited' | 'active' | 'disabled'");
    expect(broker).toContain("membershipStatus: 'invited' | 'active' | 'disabled'");
    expect(customer).toContain("member.membershipStatus === 'disabled'");
    expect(broker).toContain("member.membershipStatus === 'disabled'");
  });
});
