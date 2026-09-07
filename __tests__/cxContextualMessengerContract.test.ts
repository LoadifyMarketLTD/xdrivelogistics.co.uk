import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const quoteMessageApi = read('app/api/customer/bids/[id]/message/route.ts');
const contextHelper = read('app/api/_lib/messageContext.ts');
const workspaceApi = read('app/api/workspace/messages/route.ts');
const driverApi = read('app/api/driver/messages/route.ts');
const workspaceUi = read('app/components/workspace/ParticipantMessagesPage.tsx');
const driverUi = read('app/driver/messages/page.tsx');
const customerQuotes = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const directory = read('app/components/workspace/MemberDirectoryPage.tsx');
const jobSheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');

describe('CX contextual Freight Messenger contract', () => {
  it('anchors quote-origin messaging to the exact real bid and derives the recipient server-side', () => {
    expect(quoteMessageApi).toContain('const recipientUserId = typeof bid.bidder_user_id');
    expect(quoteMessageApi).toContain('const conversationId = String(bid.id);');
    expect(quoteMessageApi).toContain(".eq('conversation_id', conversationId)");
    expect(quoteMessageApi).toContain('Quote conversation context conflicts with its verified participants.');
    expect(quoteMessageApi).not.toContain('payload.recipient');
    expect(quoteMessageApi).not.toContain('randomUUID');
  });

  it('derives quote/job and participant/company context from canonical records only', () => {
    expect(contextHelper).toContain("client.from('job_bids')");
    expect(contextHelper).toContain("client.from('jobs')");
    expect(contextHelper).toContain("client.from('profiles')");
    expect(contextHelper).toContain("client.from('drivers')");
    expect(contextHelper).toContain("client.from('company_memberships')");
    expect(contextHelper).toContain("client.from('companies')");
    expect(contextHelper).toContain("kind: 'quote'");
    expect(contextHelper).toContain("kind: 'job'");
  });
  it('enriches workspace and driver threads without fabricating context or read state', () => {
    for (const api of [workspaceApi, driverApi]) {
      expect(api).toContain('loadMessageContextMap');
      expect(api).toContain('loadParticipantIdentityMap');
      expect(api).toContain('counterpartCompanyId');
      expect(api).toContain('counterpartCompanyName');
      expect(api).toContain('contextPartial');
      expect(api).toContain('readStateAvailable: false');
      expect(api).toContain("const key = row.conversation_id || `legacy:${row.id}`;");
      expect(api).toContain('canReply: Boolean(latest?.conversation_id && singleCounterpart)');
    }
    expect(workspaceApi).toContain('arbitraryRecipientCreationAvailable: false');
  });

  it('selects only verified contextual threads with strict target precedence', () => {
    for (const ui of [workspaceUi, driverUi]) {
      expect(ui).toContain("searchParams.get('conversation')");
      expect(ui).toContain("searchParams.get('bidId')");
      expect(ui).toContain("searchParams.get('jobId')");
      expect(ui).toContain("searchParams.get('companyId')");
      expect(ui).toContain('const contextualMatch = targetConversation');
      expect(ui).toContain(': targetBidId');
      expect(ui).toContain(': targetJobId');
      expect(ui).toContain(': targetCompanyId');
      expect(ui).toContain('No verified conversation exists for the requested job, quote or member context.');
      expect(ui).toContain('contextPartial');
      expect(ui).toContain('Open job');
    }
  });

  it('does not allow contextual navigation to create an arbitrary recipient', () => {
    expect(directory).toContain('router.push(`${messagesRoute}?companyId=${encodeURIComponent(companyId)}`)');
    expect(workspaceUi).toContain('arbitrary recipient creation stays disabled');
    expect(driverUi).toContain('arbitrary recipient creation stays disabled');
    expect(workspaceApi).not.toContain('recipient_user_id: payload');
    expect(driverApi).not.toContain('recipient_user_id: body');
  });
  it('links Customer Quotes and Job Sheet into contextual messaging', () => {
    expect(customerQuotes).toContain("conversationId?: string");
    expect(customerQuotes).toContain('bidId=${encodeURIComponent(messageCandidate.bid.id)}');
    expect(customerQuotes).toContain('jobId=${encodeURIComponent(messageCandidate.job.id)}');
    expect(customerQuotes).toContain('conversation=${encodeURIComponent(payload.conversationId)}');
    expect(jobSheet).toContain('Messages for this job');
    expect(jobSheet).toContain('/customer/messages?jobId=');
    expect(jobSheet).toContain('/broker/messages?jobId=');
    expect(jobSheet).toContain('/admin/messages?jobId=');
  });

  it('keeps historical rows visible, immutable and unrepliable without a verified conversation', () => {
    expect(workspaceUi).toContain('Legacy message record');
    expect(driverUi).toContain('Legacy message record');
    expect(workspaceUi).toContain('messages are immutable once sent');
    expect(driverUi).toContain('messages cannot be edited after sending');
    expect(workspaceApi).toContain('They remain visible as immutable records and cannot be replied to.');
    expect(driverApi).toContain('They are immutable legacy records.');
  });
});
