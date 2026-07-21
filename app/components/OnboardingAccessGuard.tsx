'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const workspacePrefixes = ['/admin', '/broker', '/customer', '/driver', '/dashboard'];
const editableStatuses = new Set(['invited', 'draft', 'in_progress', 'request_changes']);
const reviewStatuses = new Set(['submitted', 'under_review', 'compliance_review', 'admin_approval']);

export default function OnboardingAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!workspacePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return;
    }

    let cancelled = false;
    const verifyAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) return;

      const { data: application, error } = await supabase
        .from('onboarding_applications')
        .select('status')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (cancelled || error || !application) return;

      const status = String(application.status ?? '').trim().toLowerCase();
      if (status === 'approved') return;
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
      }
    };

    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
