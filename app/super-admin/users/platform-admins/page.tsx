import { redirect } from 'next/navigation';

/**
 * SA-11 decision gate:
 * XDrive does not currently have a delegated Platform Administrator lifecycle.
 * The only canonical platform-wide authority is the active Platform Owner
 * identity sourced from profiles.role = 'owner'. Keep this legacy route as a
 * compatibility redirect instead of presenting non-existent grant/revoke
 * controls or inventing a second privileged role.
 */
export default function Page() {
  redirect('/super-admin/users/roles/platform_owner');
}
