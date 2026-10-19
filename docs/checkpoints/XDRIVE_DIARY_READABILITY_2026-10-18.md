# XDrive Diary readability — 18 October 2026

Release preflight for `fix/diary-readable-type`, integrated over main `28756182`. Publication/deployment must be checked against GitHub current main and the deployed site. No transport records, memberships, finance data or backend permissions were changed. No payments were made.

## One presentation across seven workspaces

| Workspace | Route | Shared rendering |
| --- | --- | --- |
| Carrier / company admin | /admin/diary | OperationsDiaryPage, CxDiaryCard, CxDiaryActions |
| Fleet manager | /admin/diary | Same |
| Dispatcher | /admin/diary | Same |
| Customer | /customer/diary | CxDiaryCard, CxDiaryActions |
| Broker | /broker/diary | CxDiaryCard, CxDiaryActions |
| Owner driver | /driver/history | CxDiaryCard, CxDiaryActions |
| Employed driver | /driver/history | Same |

All use workspace-measured-cx-baseline.css. Shared actions have the same order: POD, Order, Notes, History, Documents, invoice. Existing driver ownership and invoice eligibility restrictions remain. Existing booking, replay, POD completion, cancellation and feedback workflows remain available. Customer booking action remains hidden before award.

| Information | Shared CSS size |
| --- | --- |
| From / To address | 16px, 20px line height |
| Pickup / delivery primary value | 16px, 20px line height |
| Date / timezone metadata | 14px, 18px line height |
| From / To / Pickup / Deliver labels | 14px, 18px line height |
| Status band and completed-by name | 16px, 20px line height |
| Status timestamp, Load ID, vehicle caption | 14px |
| Expanded metadata labels / values | 14px / 16px |
| Timeline, detailed records, table contents | 14px minimum in targeted content |
| Filters, tabs, pagination, toolbar and footer buttons | 14px |
| Vehicle image | 46 x 20px, unchanged |
| Footer button height | 25px, unchanged |

Approved desktop column proportions and baseline spacing remain. Text can wrap and increase natural height. On narrow screens the existing stacked layout now stays within the card viewport; desktop widths are not forced onto mobile cards. Removed driver-only footer wrapper and its smaller legacy styling. Added the missing Diary vehicle class to the shared renderer.

## Supplied screenshot measurements

These are raster bounds from the supplied images, not DOM or CSS measurements; widths and possible browser zoom differ.

| Measurement | CX image 135303 | XD image 135331 |
| --- | --- | --- |
| Image size | 1456 x 712px | 1711 x 604px |
| First complete visible card | about 1456 x 368px | about 1698 x 293px |
| Main section | about 207px high | about 104px high |
| Column proportions | about 36.4 / 36.5 / 27.1% | about 38 / 38 / 24% |
| Gap to next card | about 8px | about 8px |
| Footer | about 22px high | about 24px high |
| Primary address glyph ink height | about 10.7px | about 10.7px |
| Date glyph ink height | about 11px | about 8px |

The XD screenshot contains accepted-quote content (SOLD, Quote Notes, Your Quote Accepted), rather than the same expanded Diary structure as CX. Its exact route is not visible. Text ink height must not be confused with CSS font size.

Inspected information includes route addresses, pickup/delivery windows and dates, status and actor timestamp, load ID, vehicle, booking company and member contact, agreed rate, references, distance, weight, packaging, dimensions, payment terms, hard-copy POD, notes, pickup/delivery milestones, recipient, items, delivery status, feedback and document actions. SmartPay was not introduced.

## Verification actually executed

- TypeScript: exit 0 after all source/test changes on Linux and in the new Windows PowerShell process. Windows git diff --check also exited 0; only CRLF conversion notices were emitted.
- Integrated Vitest selection: 52 files / 253 tests passed, covering Diary and the navigation tests affected by the concurrent main commit. The original feedback-filter test expected profiles.id/email; reproduced on pristine 61378735 and then updated to verify the canonical user_id/full_name lookup and mapping already implemented in the endpoint. No endpoint authorization was changed.
- Behavioral shared-action tests: two passing tests verify section callback mapping/order, toggle, role filtering and invoice busy state.
- New PowerShell process on isolated Windows worktree D:\XDrive-Diary-Legibility; original D:\XDrive-CX-Debug was not modified.
- Playwright using installed Microsoft Edge: four tests passed. Actual browser checks at 1680, 1024 and 390px verify 14/16px computed fonts, card bounds, vehicle image dimensions and expand/collapse behavior.
- Fourth browser test injects each role layout's actual CSS and compares identical shared-card content across all seven style contexts. Typography and measured geometry match. This is a component style comparison, not seven authenticated sessions.
- Desktop and expanded/mobile screenshots inspected. No runtime page errors in the local rendering probe.
- git diff --check: clean.

Not verified by this UI release preflight: production deployment of this commit, real financial flow or payment execution. No global financial/production PASS is claimed. Fixture checks are identified separately from authenticated checks; no mock production records were created.

## Files and reproduction

Shared source: app/components/workspace/CxDiaryCard.tsx, CxDiaryActions.tsx, OperationsDiaryPage.tsx, workspace-measured-cx-baseline.css, admin-marketplace-identity.css; customer/broker Diary and driver history pages.

Tests: e2e/diary-readable.spec.ts and __tests__/cxDiaryActions.test.tsx; four existing source-contract tests updated for extraction into the shared actions renderer.

Local browser test: set E2E_VISUAL_FIXTURE=true and start the dev server with placeholder public Supabase settings; run e2e/diary-readable.spec.ts. This fixture is disabled in production.

Windows evidence: D:\XDrive-Diary-Legibility-e2e.log, D:\XDrive-Diary-browser-results.json, D:\XDrive-Diary-desktop.png, D:\XDrive-Diary-expanded.png, D:\XDrive-Diary-mobile.png.


## Authenticated checks and concurrent main integration

The authorized Desktop E2E file is consumed only in the Windows test process. Credentials are never printed or included in screenshots, source, reports or commits. The local authenticated server has E2E_VISUAL_FIXTURE=false and reads existing records through the normal user sessions and server authorization.

| Workspace | Existing visible cards | Actual coverage |
| --- | ---: | --- |
| Customer | 25 | Real cards, 14/16px fonts, expanded details, expand/collapse, three widths |
| Broker | 25 | Same |
| Carrier | 0 | Authenticated empty state, disabled expander, filters/tabs, three widths |
| Fleet manager | 0 | Same |
| Dispatcher | 0 | Same |
| Owner driver | 18 | Real cards, verified Owner Driver label, details, expand/collapse, three widths |
| Company driver | 0 | Authenticated empty state and verified non-owner Driver label, three widths |

The seven-role authenticated matrix passed again after integration over concurrent main 28756182: 7/7 tests, 2.4 minutes, at 1680/1024/390px. PowerShell TypeScript also exited 0 on the integrated source. Evidence: D:\XDrive-Diary-E2E-integrated-final.log and D:\XDrive-Diary-Final-TypeScript.json. Empty-state results do not certify nonexistent booking cards. An extra optional lifecycle Carrier diagnostic could not run because that credential set had no configured values; no mock transport or membership was created to fill the gap. The shared Operations card additionally has separate local fixture/browser coverage.

The concurrent commit 28756182 referenced DriverFleetIntegratedNav from four Driver pages but omitted the file. Recovered its existing 17-line source from the original Windows worktree into the isolated worktree without editing the original. This restores the intended owner-only My Fleet links. TypeScript and five navigation tests previously failed on that omission; all 253 integrated unit tests now pass.

Final browser evidence directory: D:\XDrive-Diary-Authenticated-20261018. Final PowerShell scripts/logs are on D:. Main writes must preserve concurrent changes and use a matching expected branch SHA. The release commit uses [skip actions] to avoid GitHub Actions while allowing Netlify deployment.
