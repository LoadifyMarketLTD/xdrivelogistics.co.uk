# XDrive Role Visual Blueprint Index
Date: 2026-09-30

## Mandatory reading order
1. XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md
2. The relevant role-specific blueprint
3. XDRIVE_CARRIER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md when a shared operational pattern is referenced
4. CX_ROLE_FUNCTION_MASTER_BLUEPRINT_2026-09-25.md
5. Repository code for that role
6. Relevant CX references under docs/reference/courier-exchange/

## Role blueprints
Carrier: XDRIVE_CARRIER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Customer: XDRIVE_CUSTOMER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Broker: XDRIVE_BROKER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Owner Driver: XDRIVE_OWNER_DRIVER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Employed Driver: XDRIVE_EMPLOYED_DRIVER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Fleet Manager: XDRIVE_FLEET_MANAGER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Dispatcher: XDRIVE_DISPATCHER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Finance: XDRIVE_FINANCE_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md
Compliance: XDRIVE_COMPLIANCE_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md

## Explicit exclusion
Super Admin is intentionally excluded and remains on its separate shell/system.

## Non-interpretation rule
If a visual value is absent from a role blueprint, use the master contract exactly.
If the master also does not define it, amend the relevant blueprint with an exact numeric value before implementation.
Do not invent geometry in code.
