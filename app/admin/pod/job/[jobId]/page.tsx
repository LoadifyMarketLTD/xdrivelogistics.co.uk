import Link from 'next/link';
import PodWorkspaceViewer from '../../../../components/workspace/PodWorkspaceViewer';

export default async function ArchivedBookingPodPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <main style={{ maxWidth: 1050, margin: '0 auto', padding: 16 }}>
      <Link href="/admin/diary" style={{ display: 'inline-block', marginBottom: 16 }}>Back to Diary</Link>
      <PodWorkspaceViewer jobId={jobId} title="Archived booking · Proof of Delivery" />
    </main>
  );
}
