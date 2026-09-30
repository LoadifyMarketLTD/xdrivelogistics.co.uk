'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { COMPANY_CONFIG } from '../../config/company';
import { useAuth } from '../AuthContext';
import { getWorkspaceHomeRoute, resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { hasWorkspaceCapabilityForContext } from '../../../lib/roleCapabilities';
import { ActionButton, PageFrame, PageHeader, Panel } from './WorkspaceUI';
import styles from './WorkspaceSupportPage.module.css';

export default function WorkspaceSupportPage({
  eyebrow, settingsRoute, legalRoute, notificationsRoute,
}: {
  eyebrow: string;
  settingsRoute: string;
  legalRoute?: string;
  notificationsRoute?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restriction = (searchParams?.get('reason') ?? '').replace(/[^a-z0-9_:\- ]/gi, '').slice(0, 180);
  const { user } = useAuth();
  const role = user ? resolveWorkspaceRole(user) : null;
  const canOpenSettings = role === 'driver' || role === 'owner_driver' || (role !== null && hasWorkspaceCapabilityForContext(role, 'settings.manage', { membershipRole: user?.membershipRole ?? null }));
  const returnRoute = canOpenSettings ? settingsRoute : role ? getWorkspaceHomeRoute(user) : settingsRoute.split('/settings')[0];
  const returnLabel = canOpenSettings ? 'Back to Settings' : 'Back to workspace';
  return (
    <PageFrame>
      <PageHeader eyebrow={eyebrow} title="Help & Support"
        description="Account help, operational guidance and support contacts for this workspace."
        actions={<ActionButton tone="secondary" onClick={() => router.push(returnRoute)}>{returnLabel}</ActionButton>} />
      {restriction && <Panel title="Help with this restriction" description="The restriction reference is included so you do not need to find it again.">
        <p><strong>Restriction:</strong> {restriction.replace(/_/g, ' ')}</p>
        <p>Company-controlled settings require your company owner or administrator. XDrive support can help identify the correct next step, but this does not grant extra permissions or approve documents.</p>
        <a href={'mailto:' + COMPANY_CONFIG.email + '?subject=' + encodeURIComponent('Workspace restriction: ' + restriction) + '&body=' + encodeURIComponent('Workspace: ' + eyebrow + '\nCompany ID: ' + (user?.companyId ?? 'not linked') + '\nRestriction: ' + restriction + '\nPlease help me resolve this restriction.')}>
          Email XDrive about this restriction
        </a>
      </Panel>}
      <div className={styles.grid}>
        <Panel title="Workspace help" description="Open a topic without leaving your workspace.">
          <div className={styles.topics}>
            <details><summary>A job or quote action is blocked</summary>
              <p>Read the restriction shown beside the action. Use its completion button to open the required setup or documents. A restriction on another company must be resolved by that company.</p>
            </details>
            <details><summary>Finance settings, invoices or membership billing?</summary>
              <p>Company Finance Settings contains company invoice and payment preferences. Finance &amp; Invoices contains transport financial records. Billing &amp; Membership manages the XDrive subscription. Available actions depend on your company permissions.</p>
            </details>
            <details><summary>Company driver access</summary>
              <p>Company drivers execute assigned work and record delivery evidence. Commercial and membership setup belongs to the company. Contact your company owner or administrator when a company restriction needs attention.</p>
            </details>
            <details><summary>Reporting an operational issue</summary>
              <p>Include the job or invoice reference, your workspace, the action you attempted and any error reference. Do not send passwords, authentication codes, full payment card details or private customer documents by email.</p>
            </details>
          </div>
        </Panel>
        <Panel title="Contact XDrive" description="Use the published support contact details.">
          <div className={styles.contacts}>
            <a href={`mailto:${COMPANY_CONFIG.email}`}>{COMPANY_CONFIG.email}</a>
            <a href={`tel:${COMPANY_CONFIG.phone}`}>{COMPANY_CONFIG.phoneDisplay}</a>
            <span>For account issues, include your company or member ID.</span>
          </div>
        </Panel>
        <Panel title="Account & compliance" description="Records and updates for the current workspace.">
          <div className={styles.actions}>
            <Link href={returnRoute}>{canOpenSettings ? 'Workspace Settings' : 'Workspace home'}</Link>
            {legalRoute ? <Link href={legalRoute}>Legal &amp; Agreements</Link> : null}
            {notificationsRoute ? <Link href={notificationsRoute}>Latest Updates</Link> : null}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
