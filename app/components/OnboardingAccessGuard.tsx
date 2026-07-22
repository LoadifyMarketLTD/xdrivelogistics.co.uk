'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from './AuthContext';

const workspacePrefixes = ['/admin', '/broker', '/customer', '/driver', '/dashboard'];
const editableStatuses = new Set(['invited', 'draft', 'in_progress', 'request_changes']);
const reviewStatuses = new Set(['submitted', 'under_review', 'compliance_review', 'admin_approval']);
const missingColumnCodes = new Set(['42703', 'PGRST204']);

const isWorkspacePath = (pathname: string) =>
  workspacePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export default function OnboardingAccessGuard() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const workspacePath = useMemo(() => isWorkspacePath(pathname), [pathname]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!workspacePath || isLoading || !user?.id) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const verifyAccess = async () => {
      let profileResult = await supabase
        .from('profiles')
        .select('role, is_internal_account')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        profileResult.error &&
        missingColumnCodes.has(String(profileResult.error.code ?? ''))
      ) {
        profileResult = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle() as typeof profileResult;
      }

      if (cancelled) return;
      if (profileResult.error) {
        // Authentication and route permissions still protect the workspace.
        // Do not lock a legitimate user out during a transient profile read.
        setChecking(false);
        return;
      }

      const profile = profileResult.data as {
        role?: string | null;
        is_internal_account?: boolean | null;
      } | null;
      const profileRole = String(profile?.role ?? '').trim().toLowerCase();
      if (profile?.is_internal_account === true || profileRole === 'owner') {
        setChecking(false);
        return;
      }

      const { data: application, error } = await supabase
        .from('onboarding_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !application) {
        // Legacy and invited fleet-driver accounts may not have their own
        // onboarding row. Existing role and tenant guards remain authoritative.
        setChecking(false);
        return;
      }

      const status = String(application.status ?? '').trim().toLowerCase();
      if (status === 'approved') {
        setChecking(false);
        return;
      }
      if (editableStatuses.has(status)) {
        router.replace('/onboarding/resume');
        return;
      }
      if (reviewStatuses.has(status)) {
        router.replace('/pending-approval');
        return;
      }
      if (status === 'rejected') {
        router.replace('/forbidden?reason=onboarding-rejected');
        return;
      }

      setChecking(false);
    };

    void verifyAccess().catch(() => {
      if (!cancelled) setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, router, user?.id, workspacePath]);

  if (!workspacePath || !checking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: '#f4f6f8',
        color: '#0b2f6b',
        fontWeight: 700,
      }}
    >
      Checking account access…
    </div>
  );
}
