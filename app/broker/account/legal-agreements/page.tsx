import LegalAgreementsPage from '../../../components/workspace/LegalAgreementsPage';

export default function BrokerLegalAgreementsPage() {
  return (
    <LegalAgreementsPage
      recoveryHref="/onboarding/resume"
      supportHref="/broker/support?reason=legal-contractual-role"
      eyebrow="Broker account"
      description="Review the agreements accepted for your Transport Broker account, exact versions and immutable evidence history."
    />
  );
}
