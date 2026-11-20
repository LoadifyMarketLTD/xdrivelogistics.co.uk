import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {renewSession,resetLiveSession,driverGet} from '../driver-pwa-reserve/src/liveApi';
const session=(key:string,expiresAt=0)=>({token:'access-'+key,refreshToken:key,expiresAt});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const endpoint='https://jqxlauexhkonixtjvljw.supabase.co';
let calls:string[];
let blockers:Map<string,(r:Response)=>void>;
beforeEach(()=>{resetLiveSession();calls=[];blockers=new Map();vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{if(url.endsWith('/mobile/config'))return json({supabaseUrl:endpoint,supabaseAnonKey:'fixture-public-key'});if(url.includes('grant_type=refresh_token')){const key=JSON.parse(String(init?.body)).refresh_token;calls.push(key);return new Promise<Response>(resolve=>blockers.set(key,resolve));}return json({error:'Access has been disabled'},403);}));});
afterEach(()=>{resetLiveSession();vi.unstubAllGlobals();});
const wait=async(key:string)=>{await vi.waitFor(()=>expect(blockers.has(key)).toBe(true));};
const release=(key:string)=>blockers.get(key)!(json({access_token:'renewed-'+key,refresh_token:'next-'+key,expires_in:3600}));
describe('PWA phase 1 session security',()=>{
it('deduplicates renewal for the same session',async()=>{const a=renewSession(session('a'));const b=renewSession(session('a'));await wait('a');release('a');expect((await a).token).toBe('renewed-a');expect(await b).toEqual(await a);expect(calls).toEqual(['a']);});
it('does not transfer credentials between distinct sessions',async()=>{const a=renewSession(session('a'));const b=renewSession(session('b'));await wait('a');await wait('b');release('a');release('b');expect((await a).token).toBe('renewed-a');expect((await b).token).toBe('renewed-b');expect((await renewSession(session('a',Date.now()+600000))).token).toBe('access-a');});
it('rejects renewal completed after logout',async()=>{const a=renewSession(session('a'));const assertion=expect(a).rejects.toThrow('Session expired');await wait('a');resetLiveSession();release('a');await assertion;});
it('retains authority failure HTTP status even with custom error',async()=>{await expect(driverGet('/profile','fixture')).rejects.toThrow('HTTP 403');});
});
