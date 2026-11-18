import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  company: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  appMetadata: {} as Record<string, unknown>, userMetadata: {} as Record<string, unknown>,
  rpc: vi.fn(),
}));
const client = vi.hoisted(() => ({
  from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const result = (single: boolean) => {
      const rows = (state.tables[table] ?? []).filter(row => filters.every(([key,value]) => row[key] === value));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const chain = {
      select: () => chain, order: () => chain, limit: () => chain, returns: () => chain,
      eq: (key: string, value: unknown) => { filters.push([key,value]); return chain; },
      maybeSingle: async () => result(true),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result(false)).then(resolve),
    };
    return chain;
  },
  rpc: state.rpc,
  auth: { getUser: async () => ({data:{user:{id:state.actor,app_metadata:state.appMetadata,user_metadata:state.userMetadata}},error:null}) },
}));
vi.mock('../lib/supabaseClient', () => ({supabase:client}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({isSupabaseAdminConfigured:true,supabaseAdmin:client,supabaseValidator:client}));
import { getPostLoginRoute, resolveAuthenticatedUser, roleCanAccessPath } from '../lib/authSession';
import { middleware, resolveRouteAuth } from '../middleware';
import { isRoleAllowedForPath } from '../lib/authRole';
const request=(path:string)=>new NextRequest('http://localhost'+path,{headers:{cookie:'xdrive-route-access-token=test-token'}});
const session=()=>({id:state.actor,email:'synthetic@example.test',app_metadata:state.appMetadata,user_metadata:state.userMetadata});

beforeEach(()=>{
  state.appMetadata={};
  state.userMetadata={role:'driver',account_type:'owner_driver',signup_type:'fleet_operator'};
  const company={id:state.company,name:'Approved owner transport',created_by:state.actor,company_type:'owner_driver',status:'active'};
  state.tables={
    profiles:[{id:state.actor,user_id:state.actor,role:'driver',status:'active',is_driver:true,company_id:state.company}],
    companies:[company],
    company_memberships:[{id:'membership',user_id:state.actor,company_id:state.company,role_in_company:'owner',status:'active',companies:company}],
    drivers:[{id:'driver',user_id:state.actor,company_id:state.company,driver_type:'owner_driver',status:'active',app_access:true,can_commercial_bid:true,must_change_password:false}],
  };
  state.rpc.mockReset().mockImplementation(async()=>{throw new Error('Access resolution must not provision or activate anything');});
});

describe('approved owner-driver access uses canonical records, not missing signup flags',()=>{
  it('routes an approved owner-driver to their own driver workspace without metadata flags',async()=>{
    const result=await resolveAuthenticatedUser(session());
    expect(result.reason).toBeNull(); if(!result.user)throw Error('Expected resolved user');
    expect(result.user.workspaceRole).toBe('owner_driver');
    expect(result.user.ownerDriverWorkspace).toBe(true);
    expect(getPostLoginRoute(result.user)).toBe('/driver');
    expect(roleCanAccessPath(result.user,'/driver')).toBe(true);
    expect(roleCanAccessPath(result.user,'/super-admin')).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('uses the same canonical driver type in server middleware',async()=>{
    const result=await resolveRouteAuth(request('/driver'));
    expect(result.kind).toBe('authenticated'); if(result.kind!=='authenticated')throw Error('Expected route authentication');
    expect(result.workspaceRole).toBe('owner_driver');
    expect(result.ownerDriverWorkspace).toBe(true);
    expect(isRoleAllowedForPath('/driver',result.role,result)).toBe(true);
    const response=await middleware(request('/driver'));
    expect(response.headers.get('location')).toBeNull();
  });
  it('never upgrades a company driver from editable user metadata',async()=>{
    state.tables.drivers[0].driver_type='company_driver';
    state.tables.company_memberships[0].role_in_company='driver';
    state.tables.companies[0].company_type='standard';
    const result=await resolveAuthenticatedUser(session());
    expect(result.user?.workspaceRole).toBe('driver');expect(result.user?.ownerDriverWorkspace).toBe(false);
  });
  it('does not override canonical company_driver with stale server-side owner metadata',async()=>{
    state.appMetadata={role:'driver',owner_driver_workspace:true};
    state.tables.drivers[0].driver_type='company_driver';
    state.tables.company_memberships[0].role_in_company='driver';
    state.tables.companies[0].company_type='standard';
    const result=await resolveAuthenticatedUser(session());expect(result.user?.ownerDriverWorkspace).toBe(false);
    const route=await resolveRouteAuth(request('/driver'));
    expect(route.kind).toBe('authenticated');if(route.kind==='authenticated')expect(route.ownerDriverWorkspace).toBe(false);
  });
  it.each(['pending','suspended','inactive'])('does not admit a %s account',async status=>{
    state.tables.profiles[0].status=status;
    expect((await resolveAuthenticatedUser(session())).user).toBeNull();
    expect((await resolveRouteAuth(request('/driver'))).kind).toBe('forbidden');
  });
  it('keeps disabled driver app access denied',async()=>{
    state.tables.drivers[0].app_access=false;
    const response=await middleware(request('/driver'));
    expect(response.headers.get('location')).toContain('/forbidden');
  });
  it('does not use a different company driver record to choose owner-driver workspace',async()=>{
    state.tables.drivers[0].company_id='different-company';
    const result=await resolveAuthenticatedUser(session());
    expect(result.user?.ownerDriverWorkspace).toBe(false);
    expect(result.user?.driverId).toBeNull();
  });
  it('preserves the platform-owner boundary regardless of driver classification',async()=>{
    const response=await middleware(request('/super-admin'));
    expect(response.headers.get('location')).toContain('/forbidden');
  });
});


describe('stale owner-driver entry recovery', () => {
  it('redirects the old admin home to the canonical driver home without admitting the admin workspace', async () => {
    state.userMetadata = { role: 'company_admin', signup_type: 'fleet_operator', account_type: 'fleet_courier', owner_driver_workspace: false };
    const response = await middleware(request('/admin'));
    expect(new URL(response.headers.get('location')!).pathname).toBe('/driver');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not treat an old nested admin URL as an owner-driver access grant', async () => {
    const response = await middleware(request('/admin/settings'));
    expect(new URL(response.headers.get('location')!).pathname).toBe('/forbidden');
  });
});


describe('old admin home recovery retains permission checks', () => {
  it.each(['pending', 'suspended', 'inactive'])('keeps a %s profile out', async status => {
    state.tables.profiles[0].status = status;
    const response = await middleware(request('/admin'));
    expect(response.headers.get('location')).toContain('/forbidden');
  });
  it.each(['inactive', 'suspended'])('keeps a %s driver out', async status => {
    state.tables.drivers[0].status = status;
    expect((await middleware(request('/admin'))).headers.get('location')).toContain('/forbidden');
  });
  it('does not redirect a disabled or absent scoped driver as an active owner', async () => {
    state.tables.drivers[0].app_access = false;
    expect((await middleware(request('/admin'))).headers.get('location')).toContain('/forbidden');
    state.tables.drivers = [];
    expect((await middleware(request('/admin'))).headers.get('location')).toContain('/forbidden');
  });
  it('does not infer owner-driver recovery from metadata or another company', async () => {
    state.tables.drivers[0].driver_type = 'company_driver';
    state.appMetadata = { owner_driver_workspace: true };
    expect((await middleware(request('/admin'))).headers.get('location')).toContain('/forbidden');
    state.tables.drivers[0].driver_type = 'owner_driver';
    state.tables.drivers[0].company_id = 'foreign-company';
    expect((await middleware(request('/admin'))).headers.get('location')).toContain('/forbidden');
  });
});
