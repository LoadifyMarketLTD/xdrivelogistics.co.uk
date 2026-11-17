import { describe, expect, it } from 'vitest';
import { isCrmStagingWriteAllowed, type CrmWriteGateInput } from '../lib/business-development/crmWriteGate';

const valid: CrmWriteGateInput={
  context:'branch-deploy',
  vercelEnvironment:'development',
  deploymentIsPreview:false,
  enabled:'enabled',
  databaseScope:'isolated_staging',
  stagingSupabaseUrl:'https://isolated-test.supabase.co/',
  connectedSupabaseUrl:'https://isolated-test.supabase.co/',
};
describe('CRM isolated write gate remains fail closed',()=>{
  it('requires every staging attestation and exact database origin',()=>{
    expect(isCrmStagingWriteAllowed(valid)).toBe(true);
  });
  it.each([
    {context:'production'},
    {context:'deploy-preview'},
    {vercelEnvironment:'production'},
    {vercelEnvironment:'preview'},
    {deploymentIsPreview:true},
    {enabled:'disabled'},
    {enabled:undefined},
    {databaseScope:'production'},
    {databaseScope:undefined},
    {connectedSupabaseUrl:undefined},
    {stagingSupabaseUrl:undefined},
    {connectedSupabaseUrl:'https://real-production.supabase.co/'},
    {connectedSupabaseUrl:'http://isolated-test.supabase.co/'},
    {stagingSupabaseUrl:'http://isolated-test.supabase.co/'},
    {stagingSupabaseUrl:'https://localhost/'},
    {connectedSupabaseUrl:'https://isolated-test.supabase.co/other'},
    {connectedSupabaseUrl:'https://user:password@isolated-test.supabase.co/'},
  ])('denies risky staging configuration %j',(change)=>{
    expect(isCrmStagingWriteAllowed({...valid,...change})).toBe(false);
  });
  it('hard-blocks known XDrive and separate Loadify Production Supabase origins',()=>{
    for(const production of [
      'https://jqxlauexhkonixtjvljw.supabase.co/',
      'https://fwdfpmfvgygvqciecesx.supabase.co/',
    ]) {
      expect(isCrmStagingWriteAllowed({...valid,stagingSupabaseUrl:production,connectedSupabaseUrl:production})).toBe(false);
    }
  });
  it('rejects fake production URLs which share a suffix but not a hostname boundary',()=>{
    expect(isCrmStagingWriteAllowed({...valid,
      stagingSupabaseUrl:'https://isolated-test.supabase.co.attacker.invalid/',
      connectedSupabaseUrl:'https://isolated-test.supabase.co.attacker.invalid/',
    })).toBe(false);
  });
});
