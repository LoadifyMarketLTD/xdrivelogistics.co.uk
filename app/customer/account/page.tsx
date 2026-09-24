import { redirect } from 'next/navigation';

export default function CustomerAccountPage() {
  redirect('/customer/settings?section=company');
}
