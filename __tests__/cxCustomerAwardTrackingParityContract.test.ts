import fs from 'node:fs';
import path from 'node:path';

const customerOps = fs.readFileSync(path.join(process.cwd(), 'app/customer/CustomerOperationalPages.tsx'), 'utf8');
const awardRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/bids/[id]/award/route.ts'), 'utf8');
const notificationArchitecture = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/071_notification_architecture.sql'), 'utf8');
const notificationBridge = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260725161000_notification_events_to_notifications_bridge.sql'), 'utf8');
const notificationProcessor = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');
const memberProfile = fs.readFileSync(path.join(process.cwd(), 'app/api/member-profile/[companyId]/route.ts'), 'utf8');
const workspaceData = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/useCompanyWorkspaceData.ts'), 'utf8');

describe('CX-close Customer quote award and tracking parity', () => {
  it('keeps real carrier comparison fields and member-profile inspection before award', () => {
    expect(customerOps).toContain("columns={['Carrier', 'Price', 'Position', 'Message', 'Submitted', 'Status', 'Decision']}");
    expect(customerOps).toContain('<MemberIdentityLink');
    expect(customerOps).toContain('Best price');
    expect(customerOps).toContain("onClick={() => void award(bid.id)}");
    expect(customerOps).toContain("onClick={() => void reject(bid.id)}");
  });

  it('keeps customer awards on the atomic role-checked backend contract', () => {
    expect(awardRoute).toContain("getFeatureFlag(supabaseAdmin, 'bid_acceptance_workflow')");
    expect(awardRoute).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(awardRoute).toContain("'accept_job_bid_atomic'");
    expect(awardRoute).not.toContain(".from('jobs').update(");
  });

  it('preserves a recipient-scoped won-load event, inbox bridge and email handler', () => {
    expect(notificationArchitecture).toContain("'bid_accepted'");
    expect(notificationArchitecture).toContain('NEW.bidder_user_id');
    expect(notificationBridge).toContain("WHEN 'bid_accepted'         THEN 'Your bid was accepted'");
    expect(notificationBridge).toContain('NEW.recipient_user_id');
    expect(notificationBridge).toContain('user_id = auth.uid()');
    expect(notificationProcessor).toContain('async function handleBidAccepted');
    expect(notificationProcessor).toContain('Bid Accepted - XDrive Logistics');
  });

  it('keeps POD broadcast out of personal inbox while delivering company-operator email', () => {
    expect(notificationArchitecture).toContain("'pod_uploaded'");
    expect(notificationArchitecture).toContain('NULL, -- broadcast to company admins');
    expect(notificationBridge).toContain('IF NEW.recipient_user_id IS NULL THEN');
    expect(notificationBridge).toContain('RETURN NEW;');
    expect(notificationProcessor).toContain('async function handlePodUploaded');
    expect(notificationProcessor).toContain('emailCompanyOperators(');
    expect(notificationProcessor).toContain('Job Delivered - POD Ready');
    expect(notificationProcessor).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
  });

  it('does not fabricate member feedback, reputation, bidder ETA or distance', () => {
    expect(memberProfile).toContain("state: 'unavailable'");
    expect(memberProfile).toContain('Member-level feedback is not available for this company profile yet.');
    expect(workspaceData).toContain('export type WorkspaceBid = {');
    expect(workspaceData).not.toContain('bidder_eta');
    expect(workspaceData).not.toContain('bidder_distance');
  });

  it('keeps customer tracking states visible without changing lifecycle authority', () => {
    expect(customerOps).toContain("'upcoming' | 'live' | 'delayed' | 'delivered' | 'photo_evidence'");
    expect(customerOps).toContain('Track awarded transport from upcoming collection through live movement, delivery and available delivery-photo evidence.');
  });
});
