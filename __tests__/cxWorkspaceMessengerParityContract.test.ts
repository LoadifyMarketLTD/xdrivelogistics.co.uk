import fs from 'node:fs';
import path from 'node:path';

const api = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/messages/route.ts'), 'utf8');
const sharedMessages = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/ParticipantMessagesPage.tsx'), 'utf8');
const customerMessages = fs.readFileSync(path.join(process.cwd(), 'app/customer/messages/page.tsx'), 'utf8');
const brokerMessages = fs.readFileSync(path.join(process.cwd(), 'app/broker/messages/page.tsx'), 'utf8');
const adminMessages = fs.readFileSync(path.join(process.cwd(), 'app/admin/messages/page.tsx'), 'utf8');
const customerQuotes = fs.readFileSync(path.join(process.cwd(), 'app/customer/quotes/CustomerQuotesCxPage.tsx'), 'utf8');
const topShell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
const messageRls = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/037_secondary_table_hardening.sql'), 'utf8');

describe('CX-close participant messaging parity', () => {
  it('keeps messaging participant-scoped and existing-conversation only', () => {
    expect(api).toContain('.or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)');
    expect(api).toContain('A valid existing conversation is required.');
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
    expect(sharedMessages).toContain('no fabricated read-state');
    expect(sharedMessages).toContain('messages are immutable once sent');
    expect(sharedMessages).toContain('Legacy message record');
  });

  it('reuses one participant-conversation surface for Customer, Broker and Admin workspaces', () => {
    expect(sharedMessages).toContain("fetch('/api/workspace/messages'");
    expect(sharedMessages).toContain('Send Reply');
    expect(sharedMessages).toContain('Participant scoped');
    expect(customerMessages).toContain('ParticipantMessagesPage');
    expect(brokerMessages).toContain('ParticipantMessagesPage');
    expect(adminMessages).toContain('ParticipantMessagesPage');
  });

  it('provides role-aware navigation without exposing arbitrary recipients', () => {
    expect(topShell).toContain("customer: '/customer/messages'");
    expect(topShell).toContain("broker: '/broker/messages'");
    expect(topShell).toContain("carrier_admin: '/admin/messages'");
    expect(topShell).toContain("fleet_manager: '/admin/messages'");
    expect(topShell).toContain("dispatcher: '/admin/messages'");
    expect(topShell).toContain("label: 'Messages'");
    expect(customerQuotes).toContain("router.push('/customer/messages')");
    expect(customerQuotes).toContain('>Messages</ActionButton>');
  });
});
