import { describe, expect, it } from 'vitest';

import {
  isDriverExecutionModeRequested,
  isDriverProviderWorkspaceRequested,
} from '../lib/driverWorkspaceMode';

describe('driver workspace metadata trust boundary', () => {
  it('ignores user_metadata owner-driver flags when app_metadata does not assert them', () => {
    const userMetadata = {
      owner_driver_workspace: true,
      owner_driver_execution_mode: true,
      role: 'owner_driver',
      workspace_mode: 'execution',
    };

    expect(isDriverProviderWorkspaceRequested(userMetadata, null)).toBe(false);
    expect(isDriverExecutionModeRequested(userMetadata, null)).toBe(false);
  });

  it('accepts app_metadata owner-driver assertions', () => {
    const appMetadata = {
      owner_driver_workspace: true,
      owner_driver_execution_mode: true,
      role: 'owner_driver',
      workspace_mode: 'execution',
    };

    expect(isDriverProviderWorkspaceRequested(null, appMetadata)).toBe(true);
    expect(isDriverExecutionModeRequested(null, appMetadata)).toBe(true);
  });
});
