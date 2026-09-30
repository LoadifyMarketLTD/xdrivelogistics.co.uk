import LegalAgreementsPage from '../../../components/workspace/LegalAgreementsPage';

export default function FleetLegalAgreementsPage() {
  return (
    <LegalAgreementsPage
      recoveryHref="/onboarding/resume"
      supportHref="/admin/support?reason=legal-contractual-role"
      eyebrow="Fleet account"
      description="Review the agreements accepted for your Carrier / Fleet account, exact versions and immutable evidence history."
    />
  );
}
