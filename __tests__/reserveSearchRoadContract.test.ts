import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({
  require: vi.fn(), route: vi.fn(), eligibility: vi.fn(), from: vi.fn(),
}));
vi.mock('../app/api/driver/_lib/webDriver', () => ({ requireWebDriver: mocks.require }));
vi.mock('../app/api/driver/mobile/_lib', () => ({ isDriverContext: (v: unknown) => !(v instanceof Response) }));
vi.mock('../app/api/_lib/jobRouteMetrics', () => ({ calculateDrivingRoute: mocks.route }));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({ supabaseAdmin: {from: mocks.from} }));
vi.mock('../app/api/driver/_lib/operationalEligibility', () => ({resolveDriverOperationalEligibility: mocks.eligibility}));
import {GET as road} from '../app/api/driver/marketplace/search-road-distance/route';
import {GET as vehicle} from '../app/api/driver/marketplace/search-origin/route';

const driver = {userId:'u',driverId:'d',companyId:'c',companyStatus:'active',canCommercialBid:true};
const request = (outcode='BB1', origin=JSON.stringify({lat:53.75,lng:-2.48})) =>
  new NextRequest('https://www.xdrivelogistics.co.uk/api/driver/marketplace/search-road-distance?outcode='+encodeURIComponent(outcode), {headers:{'x-xdrive-search-origin':origin}});
const fetchPostcode=vi.fn();
const query=(result:unknown)=>{const q={select:vi.fn(),eq:vi.fn(),gte:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn(async()=>({data:result,error:null}))};for(const k of ['select','eq','gte','order','limit'] as const)q[k].mockReturnValue(q);return q;};
beforeEach(()=>{vi.resetAllMocks();mocks.require.mockResolvedValue(driver);mocks.route.mockResolvedValue({distanceMiles:12,durationMinutes:25,source:'osrm_driving'});fetchPostcode.mockResolvedValue({ok:true,json:async()=>({result:{latitude:53.7,longitude:-2.5}})});vi.stubGlobal('fetch',fetchPostcode);mocks.eligibility.mockResolvedValue({canonicalVehicleId:'v',blockers:[]});});
afterEach(()=>vi.unstubAllGlobals());
describe('Reserve search provider and authorization contract',()=>{
 it('rejects unauthenticated requests without provider calls',async()=>{mocks.require.mockResolvedValue(NextResponse.json({error:'Missing bearer token'},{status:401}));expect((await road(request())).status).toBe(401);expect((await vehicle(request())).status).toBe(401);expect(fetchPostcode).not.toHaveBeenCalled();expect(mocks.from).not.toHaveBeenCalled();});
 it('requires active commercial company',async()=>{mocks.require.mockResolvedValue({...driver,companyStatus:'suspended'});expect((await road(request())).status).toBe(403);expect((await vehicle(request())).status).toBe(403);expect(fetchPostcode).not.toHaveBeenCalled();});
 it('rejects invalid coordinates and private full postcode before provider lookup',async()=>{expect((await road(request('BB1','{"lat":100,"lng":0}'))).status).toBe(400);expect((await road(request('BB1 1AA'))).status).toBe(400);expect(fetchPostcode).not.toHaveBeenCalled();});
 it('returns provider-confirmed road mileage and public-area precision, private no-store',async()=>{const r=await road(request());expect(r.status).toBe(200);expect(await r.json()).toEqual({distanceMiles:12,source:'osrm_driving',precision:'public_outcode'});expect(r.headers.get('cache-control')).toBe('private, no-store');expect(mocks.route).toHaveBeenCalledWith([{lat:53.75,lng:-2.48},{lat:53.7,lng:-2.5}]);});
 it('fails closed without provider route',async()=>{mocks.route.mockResolvedValue(null);expect((await road(request())).status).toBe(503);});
 it('rejects ambiguous vehicle and inactive membership',async()=>{for(const blocker of ['canonical_vehicle_ambiguous','driver_company_membership_not_active']){mocks.eligibility.mockResolvedValue({canonicalVehicleId:'v',blockers:[blocker]});expect((await vehicle(request())).status).toBe(409);}expect(mocks.from).not.toHaveBeenCalled();});
 it('returns only a current position assigned to the authenticated driver company and vehicle',async()=>{const q1=query({id:'v'}),q2=query({lat:53.75,lng:-2.48,recorded_at:new Date().toISOString()});mocks.from.mockImplementation((t:string)=>t==='vehicles'?q1:q2);const r=await vehicle(request());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({latitude:53.75,longitude:-2.48});expect(q1.eq).toHaveBeenCalledWith('company_id','c');expect(q1.eq).toHaveBeenCalledWith('assigned_driver_id','d');expect(q2.eq).toHaveBeenCalledWith('company_id','c');expect(q2.eq).toHaveBeenCalledWith('driver_id','d');expect(q2.eq).toHaveBeenCalledWith('vehicle_id','v');});
 it('does not return a stale vehicle position',async()=>{const q1=query({id:'v'}),q2=query({lat:53.75,lng:-2.48,recorded_at:new Date(Date.now()-3*3600000).toISOString()});mocks.from.mockImplementation((t:string)=>t==='vehicles'?q1:q2);expect((await vehicle(request())).status).toBe(409);});
});