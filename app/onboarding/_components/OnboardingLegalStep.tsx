'use client';
import LegalAgreementsPage from '../../components/workspace/LegalAgreementsPage';
const legalRoles: Record<string, string> = {
  customer_shipper: 'customer_shipper', broker_shipper: 'transport_broker',
  fleet_courier: 'fleet_operator', owner_driver: 'owner_operator',
};
export default function OnboardingLegalStep({ applicationId, accountType, onReadinessChange }: {
  applicationId: string; accountType: string; onReadinessChange: (ready: boolean) => void;
}) {
  const role = legalRoles[accountType];
  if (!role) return null;
  return <section aria-label="Read, accept and sign onboarding agreements" style={{ marginTop: 24 }}>
    <LegalAgreementsPage embedded eyebrow="Onboarding agreements"
      description="Read each required document, select its acceptance box, then review and sign the complete package. Your onboarding details stay in this page."
      onboardingApplicationId={applicationId} expectedRegistrationRole={role}
      onReadinessChange={onReadinessChange} />
  </section>;
}
