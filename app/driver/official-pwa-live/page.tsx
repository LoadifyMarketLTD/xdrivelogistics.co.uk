import { redirect } from 'next/navigation';

/** Server redirect avoids flashing the legacy workspace header during startup. */
export default function OfficialDriverPwaLivePage() {
  redirect('/driver/reserve-pwa/index.html?live=1');
}
