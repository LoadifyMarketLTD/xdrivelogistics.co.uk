'use client';
import { use } from 'react';
import { CustomerJobPage } from '../../CustomerWorkspaceModules';
export default function CustomerJobDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerJobPage jobId={id} />;
}
