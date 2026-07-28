'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy /admin/quotes — redirects to the consolidated Commercial workspace. */
export default function QuotesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/commercial?tab=submitted');
  }, [router]);
  return null;
}
