import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('Member Directory self-service profile',()=>{
it('exposes an authorised editor for all trading company workspaces while retaining existing owner/admin guard',()=>{const s=read('app/components/workspace/RoleSettingsWorkspace.tsx');expect(s).toContain("const canEditCompany = membershipRole === 'owner' || membershipRole === 'admin'");expect(s).toContain("['customer', 'broker', 'owner', 'carrier']");expect(s).toContain('memberDirectoryEditorVisible = canEditCompany && billingRoles.includes(role)');expect(s).toContain('memberProfileOnly={!companyOperationsVisible}');});
it('does not allow saving the default form when existing data could not be read',()=>{const s=read('app/components/workspace/CompanyOperationsSettingsPanel.tsx');expect(s).toContain('if(loadedCompanyId!==companyId||saving)return');expect(s).toContain('Retry loading settings');});
it('keeps all writes capability-scoped and reputation outside self-service',()=>{const s=read('app/api/settings/company-operations/route.ts');expect(s).toContain("requireCompanyCapability(request, parsed.data.companyId, 'settings.manage')");expect(s).not.toContain(".from('reviews')");expect(s).toContain("verification_status: verificationRequired ? 'pending' : 'declared'");});
it('publishes booking footer once with preserved line breaks',()=>{expect(read('app/api/member-profile/[companyId]/route.ts')).toContain('items: [String(settings.booking_footer)]');expect(read('app/components/workspace/OwnerMemberProfile.tsx')).toContain("whiteSpace:'pre-wrap'");});
});
