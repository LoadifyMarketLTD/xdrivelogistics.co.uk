import { redirect } from 'next/navigation';

export default function DriverAccountRedirect() {
  redirect('/driver/settings?section=overview');
}
