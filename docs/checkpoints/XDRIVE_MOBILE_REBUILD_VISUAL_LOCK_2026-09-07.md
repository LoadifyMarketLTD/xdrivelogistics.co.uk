# XDrive Mobile Rebuild — Visual Lock

## Non-negotiable rule
The rebuilt XDrive Driver app must use the Delivery Information Mobile App UI Kit as its only visual source of truth.

## Forbidden sources
Do not copy or reuse any visual element from the uninstalled legacy preview app, including screens, layouts, cards, spacing, colors, typography, icons, navigation presentation, animations, screenshots, image assets, or UI wording.

Do not copy visual or code assets from Courier Exchange.

## Allowed reuse from legacy XDrive
Only non-visual technical contracts may be reused where correct: authentication, backend endpoints, data models, server-authoritative job states, POD rules, offline semantics, device/session rules, and API integration behavior.

## Build rule
All new screens, including screens absent from the selected three-screen kit, must be designed as natural extensions of Delivery Information, Detail, and Order.

## Navigation direction
Home / Deliveries / Wallet / Profile remains the primary four-domain model unless the user explicitly changes it later.