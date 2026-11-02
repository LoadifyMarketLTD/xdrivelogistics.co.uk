import { redirect } from 'next/navigation';

export default function LegacyAdminReturnJourneysPage() {
  redirect('/admin/fleet/returns');
}
