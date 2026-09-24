import { redirect } from 'next/navigation';

export default function DriverAccountProfileRedirect() {
  redirect('/driver/settings?section=profile');
}
