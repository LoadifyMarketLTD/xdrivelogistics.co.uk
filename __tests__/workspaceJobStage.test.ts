import { describe, expect, it } from 'vitest';
import {
  brokerDiaryStage,
  classifyWorkspaceJobStage,
  fleetQueueStage,
  workspaceJobPresentationStatus,
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

  it('presents stale legacy pre-award statuses from stronger persisted facts', () => {
    expect(workspaceJobPresentationStatus(job('posted', { awarded_carrier_company_id: 'carrier-1' }))).toBe('awarded');
    expect(workspaceJobPresentationStatus(job('posted', {
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
      vehicle_id: 'vehicle-1',
    }))).toBe('allocated');
  });

  it('does not present a known driver-only assignment as a complete allocation', () => {
    expect(workspaceJobPresentationStatus(job('posted', {
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
      vehicle_id: null,
    }))).toBe('awarded');
  });

  it('keeps a reduced legacy open projection conservative when vehicle truth is not loaded', () => {
    expect(workspaceJobPresentationStatus(job('posted', {
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
    }))).toBe('awarded');
    expect(workspaceJobPresentationStatus(job('allocated', {
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
    }))).toBe('allocated');
  });

  it('preserves specific execution and completion labels', () => {
    expect(workspaceJobPresentationStatus(job('loaded', { assigned_driver_id: 'driver-1', vehicle_id: 'vehicle-1' }))).toBe('loaded');
    expect(workspaceJobPresentationStatus(job('delivered', { assigned_driver_id: 'driver-1', vehicle_id: 'vehicle-1' }))).toBe('delivered');
  });
});
