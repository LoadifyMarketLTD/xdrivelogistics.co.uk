import { describe, expect, it } from 'vitest';
import { isCrmProductionWriteAllowed, type CrmProductionWriteGateInput } from '../lib/business-development/crmWriteGate';

const allowed:CrmProductionWriteGateInput={
  context:'production', deploymentIsPreview:false,
  enabled:'enabled',databaseScope:'production_xdrive',
  connectedSupabaseUrl:'https://jqxlauexhkonixtjvljw.supabase.co/',
};

describe('CRM Production write gate requires explicit owner release',()=>{
  it('accepts ONLY the exact attested XDrive Production URL and release flag',()=>{
    expect(isCrmProductionWriteAllowed(allowed)).toBe(true);
  });
  it.each([
    {context:'deploy-preview'},{context:'branch-deploy'},
    {context:'dev'},{context:undefined},
    {vercelEnvironment:'preview'},{deploymentIsPreview:true},
    {enabled:undefined},{enabled:'disabled'},
    {databaseScope:'isolated_staging'},{databaseScope:undefined},
    {connectedSupabaseUrl:'https://fwdfpmfvgygvqciecesx.supabase.co/'},
    {connectedSupabaseUrl:'https://jqxlauexhkonixtjvljw.supabase.co.attacker.invalid/'},
    {connectedSupabaseUrl:'http://jqxlauexhkonixtjvljw.supabase.co/'},
    {connectedSupabaseUrl:'https://jqxlauexhkonixtjvljw.supabase.co/other'},
    {connectedSupabaseUrl:'https://user:pass@jqxlauexhkonixtjvljw.supabase.co/'},
  ])('rejects unsafe Production configuration %j',change=>{
    expect(isCrmProductionWriteAllowed({...allowed,...change})).toBe(false);
  });
});
