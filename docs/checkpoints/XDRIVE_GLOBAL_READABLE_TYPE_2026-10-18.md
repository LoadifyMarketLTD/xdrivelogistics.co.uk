# Global readable workspace typography — 18 October 2026

User request: use the approved Diary typography throughout all seven operational workspaces, including every tab, subtab, option, button and link. Also remove the large blank area below Broker dashboard statistics shown in the supplied screenshot.

## Implementation

- Shared `workspace-readable-typography.css`, imported last by Admin, Broker, Customer and Driver layouts. These four layouts cover Carrier/Admin, Fleet Manager, Dispatcher, Broker, Customer, Owner Driver and Company Driver. The measured operational wrapper excludes Super Admin and marketing pages.
- Same font stack as approved Diary: HK Nova, Arial, sans-serif. Controls and secondary text use 14px, readable line height and the shared 600 action weight, with selected actions at 700. Primary route/date/status information uses 16px; the existing heading hierarchy is retained. Shared dashboard KPI values remain 22px.
- Root typography tokens also feed the final Marketplace identity overrides, preventing legacy 10–13px filter/control rules from winning again.
- Broker dashboard now uses two independent shared dashboard columns, matching the other operational dashboards. Statistics and commercial/report panels flow together; activity and attention panels flow together. Removed obsolete cross-column row placement. Role-specific actions, records and authorization are unchanged.

## Verification

- TypeScript passed locally on Linux and in Windows PowerShell before publication.
- Ten relevant unit/contract suites, 57 tests passed on integrated main. Three stale assertions were updated to follow the existing shared accessible expand/collapse renderers; no business behavior was changed to satisfy those assertions.
- Broker authenticated browser geometry check passed at 1920, 1680, 1024 and 390px before the global typography layer. The regression check changes only an activity panel's CSS height, adds no records, and verifies the left panel stays in place. Repeat on the final layer and deployed build before claiming final success.
- Global browser suite visits the actual routes exposed by each role's primary navigation and More menu, measures visible controls and nested text, and checks the font family and minimum 14px text. Dashboard and Loads/Quotes/Diary routes are also measured at 1024 and 390px.
- Browser credentials are read in memory from the user-authorized Desktop E2E environment. No credentials or session tokens enter the repository, screenshots or reports. No workflow submissions, real payments or fabricated operational records are required.

Final browser counts, deployment commit and any limitations will be recorded after the actual checks complete. A typography check does not certify all business workflows or external payment integrations.

## Publication and concurrent changes

- Concurrent main commits `725a6d02` and `ea729065` already introduced global 14px/16px typography. Integrated them together with main through `bf919a5d` rather than overwriting their changes. The new final layout layer reinforces those same tokens where more specific legacy role rules still win; it retains 600/700 interaction emphasis.
- Broker gap fix published separately as `8009763de73ae905a7cf4f6a3b51429ef008c331` after actual browser checks. It contains the independent columns, regression browser test and maintenance of stale source contracts. The global reinforcement layer is not part of that commit.
- First broad local sweep: Broker, Dispatcher and Company Driver completed; Customer encountered a login redirect mid-navigation, and three other roles timed out during login. These were not recorded as typography PASS. Bounded hydration/login checks and sanitized outcomes were added before repeating verification. An encountered session redirect remains explicitly recorded even if a subsequent normal UI login allows typography measurement.
- Current final global run and production deployment checks are in progress. No GitHub Actions were manually triggered. No production business records or payments were created.

## Confirmed production Broker release

- Netlify production now serves commit `8009763`'s independent Broker columns. A logged-in browser observed the new two-column DOM after deployment, then passed the same geometry assertions at 1920/1680/1024/390px.
- Production evidence: `D:/XDrive-Broker-Gap-Production.log`, `D:/XDrive-Broker-Gap-Production-20261018/broker-dashboard-flow.json` and screenshots. No claim that global reinforcement is deployed.
- Integrated Customer typography sweep completed: 18 actual navigation routes, 26 route/viewport measurements, one normal UI login, no session redirects, no visible tested control below 14px.
- Netlify CLI is not logged in in this isolated worktree; no login was initiated. Deployment was verified directly on the public site. Supabase Preview's separate failed check is not counted as a passing UI check or a new code defect.

## Final local preflight

All seven real UI account roles completed local font checks: Customer 18 routes/26 measurements; Broker 10/18; Carrier 20/26; Fleet Manager 17/21; Dispatcher 15/19; Owner Driver 17/25; Company Driver 10/14. Total 107 requested navigation routes and 149 viewport measurements, no session redirects in the successful reports. The source now also checks every visited route at all three widths for the final production sweep.

A real desktop override kept four Owner Driver Loads/Quotes navigation buttons at 10.5px. Replaced that one legacy declaration with the shared 14px interaction token; the complete Owner Driver sweep passed afterward.

Windows TypeScript discovered a pre-existing invalid named export from `app/driver/availability/live/page.tsx`. Moved the unchanged client workspace implementation into the adjacent `DriverAvailabilityLiveWorkspace.tsx`; Live Availability and My Fleet page wrappers now import that module. Updated six source-contract paths to inspect the actual implementation. Windows generated-route TypeScript then passed (exit 0 at 20:27:48 BST).

Integrated concurrent Directory commit `97623758`, preserving its changes. In a broader 16-suite run, 86 of 87 tests passed. The remaining Directory contract expects the text `Save Network`, absent already in `97623758`'s MemberDirectoryPage; its assertion was retained, not weakened. Availability privacy/authorization assertions passed separately. This is not recorded as a fully green repository suite.

The final production sweep remains required after publishing the reinforcement layer. Existing local API/content availability is not a certification of business operations or payments.

## Production build blocker and correction

Netlify deploys for `9762375`, `9c4f6b6` and `21e0061` failed in the build's ESLint stage. The failed deploy log for `9c4f6b6` (`6ad51eeb6bfc20fb52953108`) reported five unused declarations in MemberDirectoryPage: MemberProfileOverlay, savedNetworkError, profileTarget, setProfileTarget and toggleSavedCompany. These came from the earlier Directory refactor, not the typography CSS. The last published application at this point was `8009763`.

Restored the existing Owner Driver-only Save Network/Remove Saved action next to the other member actions, using the unchanged canonical toggleSavedCompany handler. Restored visible Saved Network error feedback. Removed the unused duplicate profile overlay import/state; MemberIdentityLink still handles profiles. No ESLint/build checks were disabled. The previously failing Save Network source contract now passes without changing its assertion.

Focused ESLint and TypeScript both pass. The combined release selection passes 19 suites and 98 tests, including the previously failing Directory contract. A new Netlify deployment and live typography sweep are still required; failed old-style production checks are retained as evidence and are not PASS.
