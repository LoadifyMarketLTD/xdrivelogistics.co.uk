import LegalAgreementsPage from '../../../components/workspace/LegalAgreementsPage';

export default function DriverLegalAgreementsPage() {
  return (
    <LegalAgreementsPage
      recoveryHref="/onboarding/resume"
      supportHref="/driver/support?reason=legal-contractual-role"
      eyebrow="Driver account"
      description="Review the agreements accepted for your Owner Driver / Owner-Operator account, exact versions and immutable evidence history."
    />
  );
}
