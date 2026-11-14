'use client';

import BillingSettingsPage from '../../../settings/billing/page';
import OwnerDriverSettingsSectionShell from '../../_components/OwnerDriverSettingsSectionShell';

export default function Page() {
  return <OwnerDriverSettingsSectionShell active="billing"><BillingSettingsPage /></OwnerDriverSettingsSectionShell>;
}
