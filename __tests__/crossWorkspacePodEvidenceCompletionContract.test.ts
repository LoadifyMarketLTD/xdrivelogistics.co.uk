import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('cross-workspace canonical POD / Evidence completion', () => {
  const operations = read('app/components/workspace/OperationsPodQueuePage.tsx');
  const documents = read('app/components/workspace/PodDocumentsPage.tsx');
  const viewer = read('app/components/workspace/PodWorkspaceViewer.tsx');
  const podApi = read('app/api/workspace/jobs/[jobId]/pod/route.ts');
  const brokerReview = read('app/api/broker/pod-review/[jobId]/route.ts');
  const legacyBrokerReview = read('app/api/broker/pod-review/route.ts');
  const driverPod = read('app/api/driver/web/jobs/[id]/[action]/route.ts');

  it('preserves the existing atomic Driver POD write contract', () => {
    expect(driverPod).toContain("rpc('record_driver_pod_atomic'");
    expect(driverPod).toContain('At least one delivery photo is required for POD.');
    expect(driverPod).toContain('Recipient signature is required for POD.');
    expect(driverPod).toContain('Recipient name is required for POD.');
  });

  it('uses one canonical evidence state in company, customer and broker POD registers', () => {
    expect(operations).toContain('canonicalPodEvidence');
    expect(operations).toContain('Canonical POD complete');
    expect(documents).toContain('canonicalPodEvidence');
    expect(documents).toContain('Approve POD');
    expect(documents).toContain('await workspace.refresh()');
  });

  it('never labels a partial signed presentation as automatically complete', () => {
    expect(podApi).toContain('canonicalState: evidence.state');
    expect(podApi).toContain('canonicalComplete: evidence.complete');
    expect(podApi).toContain('recipientSignature: evidence.signatureRecorded');
    expect(viewer).toContain('pod.canonicalStateLabel');
    expect(viewer).toContain('Evidence contract');
    expect(viewer).not.toContain('<StatusBadge value="Complete" tone="green" />');
  });

  it('requires the full canonical POD contract before broker approval on both review endpoints', () => {
    for (const source of [brokerReview, legacyBrokerReview]) {
      expect(source).toContain('canonicalPodEvidence(job)');
      expect(source).toContain("action === 'approve' && !pod.complete");
      expect(source).toContain('generated POD, delivery photo, recipient signature and recipient name');
    }
    expect(brokerReview).toContain('broker_pod_review_status: reviewStatusMap[action]');
    expect(brokerReview).toContain("kind: 'pod_review'");
  });

  it('keeps review decision distinct from evidence completeness and auditable', () => {
    expect(documents).toContain('POD approved');
    expect(brokerReview).toContain("event_type: 'note'");
    expect(brokerReview).toContain('pod_state: pod.state');
  });
});
