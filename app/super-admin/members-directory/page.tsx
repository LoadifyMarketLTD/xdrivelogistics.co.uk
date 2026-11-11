import { MemberDirectoryPage } from '../../components/workspace/MemberDirectoryPage';
import '../../components/workspace/workspace-measured-cx-baseline.css';

/** Approved 3118 member Directory. Shared with every operational workspace. */
export default function SuperAdminMembersDirectoryPage() {
  return <section className="xdrive-workspace-measured xdrive-carrier-workspace" aria-label="XDrive member directory"><MemberDirectoryPage /></section>;
}
