# Courier Exchange parity decision — Stop Tracking

For problem 4/15, XDrive treats availability tracking and active-job tracking as separate operational concerns, consistent with the Courier Exchange model where availability/status and live load visibility are distinct functions.

XDrive decision:

- Pre-job/availability tracking remains driver-controlled.
- Active allocated-job live tracking is mandatory while the job remains active.
- Manual job lifecycle status is not made dependent on a recently uploaded GPS point.
- Temporary network/GPS problems must not deadlock a valid job status progression.
- Android service stop paths must preserve the active-job tracking invariant.

This note records the product decision used by the regression contract in `__tests__/androidTrackingStopContract.test.ts`.
