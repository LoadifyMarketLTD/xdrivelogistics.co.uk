import LegalAgreementsPage from '../../../components/workspace/LegalAgreementsPage';

export default function CustomerLegalAgreementsPage() {
  return (
    <LegalAgreementsPage
      recoveryHref="/onboarding/resume"
      supportHref="/customer/support?reason=legal-contractual-role"
      eyebrow="Customer account"
      description="Review the agreements accepted for your Customer / Shipper account, exact versions and immutable evidence history."
    />
  );
}
