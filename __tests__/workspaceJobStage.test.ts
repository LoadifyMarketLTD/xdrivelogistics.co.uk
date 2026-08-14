import { describe, expect, it } from 'vitest';
import {
  brokerDiaryStage,
  classifyWorkspaceJobStage,
  fleetQueueStage,
  type WorkspaceStageJob,
} from '../lib/jobs/workspaceJobStage';

const job = (status: string, extra: Partial<WorkspaceStageJob> = {}): WorkspaceStageJob => ({ status, ...extra });

describe('workspace job lifecycle stage', () => {
  it('keeps accepted work allocated until execution actually starts', () => {
    expect(classifyWorkspaceJobStage(job('accepted', { assigned_driver_id: 'driver-1' }))).toBe('allocated');
    expect(classifyWorkspaceJobStage(job('on_my_way_to_pickup', { assigned_driver_id: 'driver-1' }))).toBe('in_progress');
  });

  it('separates carrier award from driver allocation', () => {
    const awarded = job('awarded', { awarded_carrier_company_id: 'carrier-1' });
    expect(classifyWorkspaceJobStage(awarded)).toBe('awarded');
    expect(fleetQueueStage(awarded)).toBe('unallocated');
  });

  it('maps broker open work to the unallocated Diary queue', () => {
    expect(brokerDiaryStage(job('posted'))).toBe('unallocated');
    expect(brokerDiaryStage(job('quoted'))).toBe('unallocated');
  });

  it('maps broker carrier-awarded work to allocated', () => {
    expect(brokerDiaryStage(job('awarded', { awarded_carrier_company_id: 'carrier-1' }))).toBe('allocated');
  });

  it('classifies completed and cancelled states canonically', () => {
    expect(classifyWorkspaceJobStage(job('delivered'))).toBe('completed');
    expect(classifyWorkspaceJobStage(job('paid'))).toBe('completed');
    expect(classifyWorkspaceJobStage(job('cancelled'))).toBe('cancelled');
    expect(classifyWorkspaceJobStage(job('driver_declined'))).toBe('cancelled');
  });
});
