import { redirect } from 'next/navigation';

export default async function MobileJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/driver/jobs/${id}`);
}
