import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/super-admin/users/roles/company_owner');
}
