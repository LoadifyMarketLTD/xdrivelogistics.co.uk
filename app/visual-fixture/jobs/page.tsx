import { notFound } from 'next/navigation';
import JobsVisualFixture from '../../../components/workspace/JobsVisualFixture';

/**
 * Deterministic visual fixture for the Jobs operational surface.
 * Fail-closed: available only in non-production builds when E2E_VISUAL_FIXTURE=true.
 * Reference: docs/ui/cx/jobs.md, e2e/jobs-visual-gate.spec.ts
 */
const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function JobsVisualFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }
  return <JobsVisualFixture />;
}
