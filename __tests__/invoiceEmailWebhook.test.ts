import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Webhook } from 'svix';
const h=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({supabaseAdmin:{rpc:h.rpc}}));
import { POST } from '../app/api/payments/webhooks/email/route';
const secret='whsec_'+Buffer.from('local-email-webhook-test-secret-32').toString('base64');
function signed(body: string, tamper=false) {
 const id='msg_local_test',now=new Date();
 return new NextRequest('https://example.test/api/payments/webhooks/email',{method:'POST',body:tamper?body+' ':body,headers:{'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':new Webhook(secret).sign(id,now,body)}});
}
const payload=()=>JSON.stringify({type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:'email_test',to:['finance@example.test'],tags:{xdrive_invoice:'invoice-test'}}});
beforeEach(()=>{process.env.RESEND_WEBHOOK_SECRET=secret;h.rpc.mockReset();h.rpc.mockResolvedValue({data:{received:true},error:null});});
describe('email delivery webhook: real signature verification',()=>{
 it('accepts valid signature and delegates to atomic event processing',async()=>{expect((await POST(signed(payload()))).status).toBe(200);expect(h.rpc).toHaveBeenCalledWith('apply_invoice_email_event',expect.objectContaining({p_type:'email.bounced',p_recipient:'finance@example.test'}));});
 it('rejects modified raw body before accessing the database',async()=>{expect((await POST(signed(payload(),true))).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled();});
 it('ignores unrelated operational emails',async()=>{const body=JSON.parse(payload());delete body.data.tags;expect((await POST(signed(JSON.stringify(body)))).status).toBe(200);expect(h.rpc).not.toHaveBeenCalled();});
 it('requests retry if acceptance record has not been persisted yet',async()=>{h.rpc.mockResolvedValue({data:null,error:{message:'not found'}});expect((await POST(signed(payload()))).status).toBe(503);});
});
