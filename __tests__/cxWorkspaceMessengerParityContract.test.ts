import fs from 'node:fs';
import path from 'node:path';

const api = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/messages/route.ts'), 'utf8');
const customerMessages = fs.readFileSync(path.join(process.cwd(), 'app/customer/messages/page.tsx'), 'utf8');
const customerQuotes = fs.readFileSync(path.join(process.cwd(), 'app/customer/quotes/CustomerQuotesCxPage.tsx'), 'utf8');
const messageRls = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/037_secondary_table_hardening.sql'), 'utf8');

describe('CX-close participant messaging parity', () => {
  it('keeps messaging participant-scoped and existing-conversation only', () => {
    expect(api).toContain('.or(`sender_user_id.eq.${auth.userId},recipient_user_id.eq.${auth.userId}`)');
    expect(api).toContain("A valid existing conversation is required.");
    expect(api).toContain('The endpoint cannot discover or contact an');
    expect(api).not.toContain('recipientUserId =');
    expect(api).not.toContain('recipient_user_id: payload');
  });

  it('reproduces the existing messages RLS contract when service role is used', () => {
    expect(messageRls).toContain('CREATE POLICY "messages_select_participant"');
    expect(messageRls).toContain('CREATE POLICY "messages_insert_sender"');
    expect(messageRls).toContain('sender_user_id = auth.uid()');
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain('Active company membership is required to reply in this conversation.');
  });

  it('does not fabricate read-state or mutate historical messages', () => {
    expect(api).toContain('readStateAvailable: false');
    expect(api).toContain('arbitraryRecipientCreationAvailable: false');
    expect(customerMessages).toContain('no fabricated read-state');
    expect(customerMessages).toContain('messages are immutable once sent');
    expect(customerMessages).toContain('Legacy message record');
  });

  it('gives Customer a real participant-conversation surface and quote-flow entry point', () => {
    expect(customerMessages).toContain("fetch('/api/workspace/messages'");
    expect(customerMessages).toContain('Send Reply');
    expect(customerMessages).toContain('Participant scoped');
    expect(customerQuotes).toContain("router.push('/customer/messages')");
    expect(customerQuotes).toContain('>Messages</ActionButton>');
  });
});
