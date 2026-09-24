import { redirect } from 'next/navigation';

export default function DriverProfileRedirect() {
  redirect('/driver/settings?section=profile');
}
