'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../components/AuthContext';

/**
 * Resolves the active company ID from the authenticated user session.
 *
 * This hook encapsulates the duplicated company-resolution pattern that
 * previously appeared verbatim in drivers, vehicles, dispatchers, and other
 * admin pages.
 *
 * Returns:
 *  - `companyId`       – resolved company UUID, or null while resolving / on error
 *  - `companyResolved` – true once the resolution attempt has completed
 *  - `companyError`    – human-readable error message when company is unavailable
 */
export function useAdminCompanyContext() {
  const { user, hasSupabaseSession } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyResolved, setCompanyResolved] = useState(false);
  const [companyError, setCompanyError] = useState('');

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) {
      setCompanyId(null);
      setCompanyResolved(false);
      setCompanyError('');
      return;
    }

    setCompanyError('');

    if (user.companyId) {
      setCompanyId(user.companyId);
      setCompanyResolved(true);
      return;
    }

    setCompanyId(null);
    setCompanyResolved(true);
    setCompanyError('Company profile not available. Data is hidden until company access resolves.');
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  return { companyId, companyResolved, companyError };
}
