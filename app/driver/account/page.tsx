'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

function AccountLink({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" className="driver-account-link" onClick={onClick}>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

export default function DriverAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const accountName = user?.email ?? 'Driver account';
  const companyLinked = Boolean(user?.companyId);
  const driverLinked = Boolean(user?.driverId);

  return (
    <DriverWorkspaceShell personaLabel="Account" driverName="Account" subtitle="Profile, vehicle, documents, finance, messages and settings in one compact account workspace.">
      <div className="driver-account-status">
        <div><span>Account</span><strong>{accountName}</strong></div>
        <div><span>Company connection</span><strong>{companyLinked ? 'Linked' : 'Not linked'}</strong></div>
        <div><span>Driver profile</span><strong>{driverLinked ? 'Active record' : 'Not linked'}</strong></div>
      </div>

      <div className="driver-account-hub">
        <section className="driver-account-column" aria-label="Account sections">
          <div className="driver-account-column__head">Account Sections</div>
          <div className="driver-account-column__body">
            <AccountLink title="Profile" detail="Identity and contact details" onClick={() => router.push('/driver/account/profile')} />
            <AccountLink title="Vehicle" detail="Capacity, equipment and readiness" onClick={() => router.push('/driver/vehicles')} />
            <AccountLink title="Documents" detail="Insurance and compliance evidence" onClick={() => router.push('/driver/documents')} />
            <AccountLink title="Finance / Invoices" detail="Earnings and payment records" onClick={() => router.push('/driver/finance')} />
            <AccountLink title="Messages" detail="Operational conversations" onClick={() => router.push('/driver/messages')} />
            <AccountLink title="Settings" detail="Password and account security" onClick={() => router.push('/driver/change-password')} />
          </div>
        </section>

        <section className="driver-account-column">
          <div className="driver-account-column__head">Operational Record</div>
          <div className="driver-account-column__body">
            <AccountLink title="Experience & Record" detail="Completed work and operational history" onClick={() => router.push('/driver/history')} />
            <AccountLink title="Event Log" detail="Search and export account activity" onClick={() => router.push('/driver/event-log')} />
            <AccountLink title="Notifications" detail="Account and job notifications" onClick={() => router.push('/driver/notifications')} />
          </div>
        </section>

        <section className="driver-account-column">
          <div className="driver-account-column__head">Working Preferences & Help</div>
          <div className="driver-account-column__body">
            <AccountLink title="Availability" detail="Working radius, live status and schedule" onClick={() => router.push('/driver/availability')} />
            <AccountLink title="Terms & Conditions" detail="Platform terms and policies" onClick={() => router.push('/terms')} />
            <AccountLink title="Help & Support" detail="Feedback and support requests" onClick={() => router.push('/support/feedback')} />
          </div>
        </section>
      </div>
    </DriverWorkspaceShell>
  );
}
