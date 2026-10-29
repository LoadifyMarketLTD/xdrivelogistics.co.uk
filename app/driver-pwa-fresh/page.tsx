import { redirect } from 'next/navigation';

/** The standalone Driver PWA opens the approved Loads workspace by default. */
export default function DriverPwaHome() {
  redirect('/driver-pwa-fresh/jobs');
}
