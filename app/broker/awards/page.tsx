import { redirect } from 'next/navigation';

export default function BrokerAwardsCompatibilityPage() {
  redirect('/broker/jobs?view=awarded');
}
