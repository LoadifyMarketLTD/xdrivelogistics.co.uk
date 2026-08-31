import { redirect } from 'next/navigation';

/** Compatibility alias for canonical Platform Action Centre. */
export default function Page() {
  redirect('/super-admin/action-centre');
}
