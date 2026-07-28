'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy /admin/bids — redirects to the consolidated Commercial workspace. */
export default function BidsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/commercial?tab=won');
  }, [router]);
  return null;
}
