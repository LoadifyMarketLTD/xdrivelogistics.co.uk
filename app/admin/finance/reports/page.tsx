'use client';
import { FinanceReportsPage } from '../../AdminWorkspaceModules';
import {useAuth} from '../../../components/AuthContext';
import {resolveWorkspaceRole} from '../../../../lib/workspaceRole';
import CompanyAdminReports from '../../../components/workspace/CompanyAdminReports';
export default function Page(){const {user}=useAuth();return (user?.workspaceRole??resolveWorkspaceRole(user))==='company_admin'?<CompanyAdminReports/>:<FinanceReportsPage/>;}