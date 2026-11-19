import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {getWorkspaceDefinition} from '../lib/workspaceRole';
import {isCapabilityAllowedForPath} from '../lib/roleCapabilities';
const m=vi.hoisted(()=>({role:'finance'}));
vi.mock('../app/components/AuthContext',()=>({useAuth:()=>({user:{workspaceRole:m.role}})}));
vi.mock('../app/components/ProtectedRoute',()=>({default:({children}:{children:React.ReactNode})=>children}));
vi.mock('../app/components/workspace/FinanceControlDashboardHome',()=>({default:()=> <div>Finance QA Home</div>}));
vi.mock('../app/components/workspace/ComplianceControlDashboardHome',()=>({default:()=> <div>Compliance QA Home</div>}));
import Finance from '../app/admin/finance/dashboard/page';import Compliance from '../app/admin/documents/dashboard/page';
describe('Master 5301 role dashboard destinations',()=>{
 it('retains registers and resolves the actual role homes',()=>{for(const [role,home,register] of [['finance','/admin/finance/dashboard','/admin/invoices'],['compliance','/admin/documents/dashboard','/admin/documents']] as const){const def=getWorkspaceDefinition(role);expect(def.homeHref).toBe(home);expect(def.nav.flatMap(g=>g.items.map(i=>i.href))).toContain(register);expect(isCapabilityAllowedForPath(home,'company_staff',{workspaceRole:role})).toBe(true);expect(isCapabilityAllowedForPath(home,'company_staff',{workspaceRole:'viewer'})).toBe(false);}});
 it('does not mount another role dashboard even if the route component is reached',()=>{m.role='finance';expect(renderToStaticMarkup(<Finance/>)).toContain('Finance QA Home');expect(renderToStaticMarkup(<Compliance/>)).not.toContain('Compliance QA Home');m.role='compliance';expect(renderToStaticMarkup(<Compliance/>)).toContain('Compliance QA Home');expect(renderToStaticMarkup(<Finance/>)).not.toContain('Finance QA Home');});
});
