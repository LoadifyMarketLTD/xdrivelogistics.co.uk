# CX Load Alerts / Notification Parity Audit

Date: 2026-08-29
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Scope: Driver / Owner Driver / Fleet / Carrier load alerts, notification delivery and alert preferences

## Reference capability

The supplied Courier Exchange material and the canonical CX Help Centre inventory distinguish ordinary notifications from **Load Alerts / Smart Alerts**. The relevant product behaviour is not just an inbox bell. It requires a rule that decides which newly available loads are relevant to a member/driver, then delivers that result through one or more channels.

Relevant matching inputs in the CX reference include current/home/GPS position, return/future journey context, route direction, vehicle suitability and user notification settings.

## Existing XDrive capability

### Notification transport — PRESENT

XDrive already has a canonical operational outbox (`notification_events`), user inbox bridge (`notifications`) and delivery processor (`notify-operational-event`). Existing event types cover operational events such as:

- job assignment;
- bid accepted;
- POD uploaded / delivered;
- invoice / dispute and onboarding events.

Recipient-scoped events can reach the user inbox and the processor can deliver configured email/push channels.

### Matching inputs — PRESENT

XDrive already stores/uses several inputs that a future load-alert matcher can consume safely:

- driver availability state;
- driver current / recorded location through the existing location contracts;
- future position / return-journey data;
- canonical vehicle type and marketplace vehicle matching;
- privacy-scoped marketplace load visibility.

These capabilities must be reused rather than duplicated.

## Missing contract

Repository audit found no canonical event type or producer for:

- `load_alert`;
- `load_match`;
- `load_available_nearby`;
- equivalent GPS/home/return-journey marketplace alert event.

There is also no verified persistent user preference model for the CX-style alert dimensions/channels (for example location/radius, vehicle match, return-journey matching, email/push/in-app enablement).

Therefore a notification bell, marketplace list or Nearby page is **not evidence that Load Alerts exist**.

## Verdict by capability

| Capability | Verdict | Reason |
|---|---|---|
| Operational notification outbox | KEEP | canonical `notification_events` pipeline exists |
| Recipient-scoped inbox | KEEP | bridge to user inbox exists for recipient events |
| Email / push delivery foundation | KEEP / runtime gate | processor exists; production wiring still needs runtime evidence |
| Driver availability input | KEEP | existing driver availability contract |
| Current location input | KEEP | existing driver location/tracking contracts |
| Future position / return journey input | KEEP | existing future-position/return-journey surfaces |
| Vehicle suitability input | KEEP | canonical vehicle matching already used by marketplace |
| Personalised load-alert matcher | BLOCKED-BY-CONTRACT | no authoritative matching producer exists |
| Load-alert persistent preferences | BLOCKED-BY-CONTRACT | no verified preference schema/API exists |
| CX-style Smart Alert equivalent | BLOCKED-BY-CONTRACT | depends on matcher + preference contract |

## Safe implementation boundary

This convergence branch must not fabricate the missing feature with localStorage-only switches, static checkboxes or client-side polling that claims to be an operational alert service.

A later protected backend phase should introduce, in order:

1. canonical persisted alert preference contract;
2. deterministic matcher using existing marketplace privacy/eligibility rules;
3. recipient resolution;
4. a canonical `notification_events` producer for matched loads;
5. deduplication/idempotency so the same load does not spam a recipient;
6. delivery-channel preference application;
7. runtime proof for in-app/email/push delivery.

The matcher must not reveal exact pre-award pickup/delivery location beyond the existing marketplace privacy contract.

## Current ledger ruling

- Driver Load Alerts: **BLOCKED-BY-CONTRACT** for the personalised alert service; supporting marketplace/location infrastructure remains KEEP.
- Fleet / Carrier Load Alerts: **BLOCKED-BY-CONTRACT** for alert rules/preferences; ordinary operational notifications remain KEEP.
- Do not mark this feature PASS until a real producer + preferences + runtime delivery are verified.
