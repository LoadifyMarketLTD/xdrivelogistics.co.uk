'use client';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import { Company3150LiveProvider } from '../try-xdrive-demo/components/Company3150LiveData';

export default function CustomerWorkspaceHome() {
  return <Company3150LiveProvider><MasterWorkspace role="Customer" authenticated /></Company3150LiveProvider>;
}
