'use client';
import type {ReactNode} from 'react';
import TopWorkspaceShell from './TopWorkspaceShell';
import './top-workspace-shell.css';
import './workspace-light-guard.css';
import './workspace-measured-cx-baseline.css';
import './dashboard-compact-global.css';
import './admin-marketplace-identity.css';
import './workspace-readable-typography.css';
import '../../admin/carrier-workspace-canonical.css';

/** The actual approved PR807 top-navigation shell; real route children remain unchanged. */
export default function AuthenticatedMasterShell({children}:{role?:string;activeTab?:number;children:ReactNode}) {
 return <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-operational-top-workspace xdrive-carrier-workspace xdrive-canonical-workspace" data-master-workspace="production"><TopWorkspaceShell>{children}</TopWorkspaceShell></div>;
}
