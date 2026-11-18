import LegalAgreementsPage from '../../../components/workspace/LegalAgreementsPage';
import OwnerDriverSettingsSectionShell from '../../_components/OwnerDriverSettingsSectionShell';

export default function DriverLegalAgreementsPage() {
  return (
    <OwnerDriverSettingsSectionShell active="legal"><LegalAgreementsPage
      eyebrow="Driver account"
      description="Review the agreements accepted for your Owner Driver / Owner-Operator account, exact versions and immutable evidence history."
    /></OwnerDriverSettingsSectionShell>
  );
}
