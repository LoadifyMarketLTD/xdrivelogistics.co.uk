'use client';

import WorkspaceRecoveryFixture from './WorkspaceRecoveryFixture';

/** Uses the production Directory component; test data comes from intercepted APIs. */
export default function CarrierDirectoryVisualFixture() {
  return <div data-testid="carrier-directory-fixture">
    <WorkspaceRecoveryFixture role="carrier" initialScreen="directory" />
  </div>;
}
