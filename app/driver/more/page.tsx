'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../../components/AuthContext';
import {
  getVisibleWorkspaceNav,
  resolveWorkspaceRole,
  type WorkspaceNavGroup,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';

const OWNER_DRIVER_PRIMARY_HREFS = new Set([
  '/driver',
  '/driver/directory',
  '/driver/availability/live',
  '/driver/vehicles',
  '/driver/returns',
  '/driver/loads',
  '/driver/quotes',
  '/driver/history',
  '/driver/freight-vision',
  '/driver/drivers-vehicles',
]);

const DRIVER_PRIMARY_HREFS = new Set([
  '/driver',
  '/driver/jobs',
  '/driver/history',
  '/driver/availability',
  '/driver/vehicles',
  '/driver/documents',
  '/driver/settings',
]);

function getMoreGroups(role: WorkspaceRole): WorkspaceNavGroup[] {
  const visible = getVisibleWorkspaceNav(role);
  const primary = role === 'owner_driver' ? OWNER_DRIVER_PRIMARY_HREFS : DRIVER_PRIMARY_HREFS;

  return visible
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !primary.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export default function DriverMorePage() {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedRole = resolveWorkspaceRole(user);
  const role: WorkspaceRole = resolvedRole === 'owner_driver' ? 'owner_driver' : 'driver';

  const groups = useMemo(() => getMoreGroups(role), [role]);
  const itemCount = groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <section className="page driver-prototype-page-shell driver-more-page">
      <div className="subbar">
        <span className="crumb">Workspace &nbsp;/&nbsp; <b>More</b></span>
        <div className="sub-actions">
          <span className="driver-more-page__count">{itemCount} tools</span>
        </div>
      </div>

      <div className="pagebody no-left">
        <main className="main">
          <div className="head driver-more-page__head">
            <div>
              <h1>More</h1>
              <p>Additional workspace tools, account controls and business functions.</p>
            </div>
          </div>

          <div className="driver-more-page__groups">
            {groups.map((group) => (
              <section key={group.id} className="driver-more-page__group">
                <div className="driver-more-page__group-head">
                  <strong>{group.label}</strong>
                  <span>{group.items.length}</span>
                </div>

                <div className="driver-more-page__items">
                  {group.items.map((item) => (
                    <button
                      key={`${group.id}:${item.id}:${item.href}`}
                      type="button"
                      className="driver-more-page__item"
                      onClick={() => router.push(item.href)}
                    >
                      <span className="driver-more-page__item-icon" aria-hidden="true">
                        {item.icon ?? '•'}
                      </span>
                      <span className="driver-more-page__item-copy">
                        <strong>{item.label}</strong>
                        <span>{group.label}</span>
                      </span>
                      <span className="driver-more-page__item-arrow" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </section>
  );
}
