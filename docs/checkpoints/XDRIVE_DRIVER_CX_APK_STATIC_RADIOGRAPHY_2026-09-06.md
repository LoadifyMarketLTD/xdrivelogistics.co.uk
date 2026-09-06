# XDrive Driver — Courier Exchange APK static radiography

Date: 2026-09-06
Workstream: `driver/phone-golden-20260718-modernization`
PR: #510 (DRAFT / NOT MERGED)

## Scope and boundary

This checkpoint records static technical observations from the user-extracted Courier Exchange Android package and the user-supplied screenshots. It is used strictly as a functional/UX benchmark for XDrive Driver.

Do not copy Courier Exchange source code, branding, logos, dominant yellow interaction palette, exact iconography, wording, proprietary trade dress, or protected implementation details. XDrive must retain its own visual identity and implementation.

## Extracted package identity

- App label: `Courier Exchange`
- Android package: `com.transportexchangegroup.cx4a`
- Extraction date recorded by the user-side script: `2026-09-06 02:43:17`
- Extracted APK count: 4
- Phone modified during extraction: NO

Extracted artifacts:

- `base.apk`
  - SHA-256: `19a28e90420c5d1638cea42262b66b4c2341929537d50191a0175e376443f366`
- `split_config.arm64_v8a.apk`
  - SHA-256: `88bb1c6fbd89ee48a7def639882bd560e54d323ad8e61d2889c70bb8136225e5`
- `split_config.en.apk`
  - SHA-256: `f6d699cd78c5668810cccbbef50fdb9a20c2c8c0ac2354a4ca4a508b4e9af5b4`
- `split_config.xxhdpi.apk`
  - SHA-256: `ad70d9dc01c886131a88f3ecdfe9c927ae767aef4e47f796fef684e330c779d1`

User-uploaded archive SHA-256 observed during analysis:

- `19a85fb8a9894305c7cdd01054e36ce39da24a4a7074a3741cf40d8e789f4ceb`

## 1. Confirmed application architecture

The installed Courier Exchange app is not a simple mobile web wrapper.

Confirmed from extracted binaries/assets:

- Flutter runtime present:
  - `libflutter.so`
  - `libapp.so`
  - `assets/flutter_assets`
- App-specific Dart source path strings are compiled into the AOT image and expose module names such as:
  - `package:fx/src/dashboard/...`
  - `package:fx/src/home/...`
  - `package:fx/src/alerts/...`
  - `package:fx/src/quotes/...`
  - `package:fx/src/bookings/...`
  - `package:fx/src/journeys/...`
  - `package:fx/src/map/...`
  - `package:fx/src/location_tracking/...`
  - `package:fx/src/freight_messenger/...`
  - `package:fx/src/document_builder/...`
  - `package:fx/src/whos_nearby/...`
- A dedicated `dashboard_bottom_navigation_bar.dart` module exists.
- Dedicated tab/shell primitives exist in the compiled app, including `teg_tab_bar.dart`, `teg_tab_panel.dart`, page builders and routing maps.

Implication for XDrive:

- The benchmark's native feel comes from a structured app shell and dedicated feature modules, not from a single global scrollable page.
- XDrive's current monolithic Driver screen must move toward a modular screen/shell architecture rather than accumulating more conditional content in one container.

## 2. Feature-module depth observed in the compiled app

Unique compiled Dart source-path counts by top-level feature area were observed approximately as follows:

- bookings: 376
- common/shared UI/infrastructure: 178
- dictionary/reference data: 160
- organisation vehicle: 117
- map: 101
- quotes: 100
- alerts: 95
- freight messenger: 94
- profile: 93
- organisation: 93
- account: 87
- location tracking: 84
- journeys: 76
- loads: 70
- host device: 70
- notifications: 68
- trust/verification: 62
- search loads: 62
- customer support: 49
- authentication: 49
- document builder: 48
- Who's Nearby: 42
- files: 36
- network manager: 33
- location suggestions: 30
- alert filters: 27
- counters: 23
- account documents: 23
- stops: 21
- home: 19
- booking member/date filters: 18
- member: 17
- document viewer: 17
- dashboard: 17
- offline manager: 16
- legal: 15
- more: 11
- smart pay: 4

These counts are not a measure of product quality by themselves. They do, however, prove that the benchmark app is decomposed into many dedicated functional layers rather than one large view.

## 3. Fixed-shell evidence

Compiled source paths confirm dedicated dashboard and shell components:

- `dashboard/ui/dashboard_bottom_navigation_bar.dart`
- `dashboard/ui/dashboard_screen.dart`
- `dashboard/ui/dashboard_page_builder.dart`
- `common/ui/teg_app_bar.dart`
- `common/ui/teg_tab_bar.dart`
- `common/ui/teg_tab_panel.dart`
- page-specific page builders and routing maps

The screenshots match this architecture:

- persistent bottom navigation;
- stable top chrome / segmented control;
- body content scrolls independently;
- detail pages keep primary navigation chrome visible;
- fixed bottom action bars are used on workflow screens.

XDrive requirement:

- Header/segmented control and bottom nav must be outside the body `ScrollView`.
- Only the content viewport scrolls.
- Job execution CTA can be fixed above bottom nav.
- Never make the whole screen look draggable or rubber-band as one document.

## 4. Navigation and primary information architecture

Confirmed from screenshots and compiled assets/source paths:

Primary bottom navigation areas:

- Home
- Alerts
- Quotes
- Bookings
- More

Dedicated active/inactive SVG assets exist for these navigation targets.

XDrive mapping:

- Home / Live work
- Alerts
- Quotes
- My Jobs / Bookings
- More

The labels may be XDrive-native, but the hierarchy should stay stable and immediately understandable.

## 5. Home screen functional anatomy

Compiled modules include:

- `home_screen.dart`
- `home_top_bar.dart`
- `home_feature_buttons.dart`
- `home_top_grid_layout.dart`
- `home_vehicle_tile.dart`
- `home_status_tile.dart`
- `home_location_tracking_tile_data.dart`

This confirms that the screenshot's top operational block is implemented as dedicated subcomponents.

XDrive Home should therefore be composed from:

- driver identity;
- assigned vehicle;
- tracking state;
- availability state;
- date/current operational context;
- quick actions such as Search, Nearby/Network and Journeys/Return opportunities;
- selected operational alert/content card beneath.

## 6. Live Loads / Alerts / Inbox

Compiled modules/assets confirm distinct handling for:

- inbox alerts;
- saved alerts;
- deleted alerts;
- alert map view;
- alert details;
- alert filters;
- alert dismiss/restore/favourite flows;
- quote-now actions from alerts.

Compiled source examples include:

- `inbox_alerts_cubit`
- `saved_alerts_cubit`
- `deleted_alerts_cubit`
- `alerts_map_screen`
- `alert_details_screen`
- `alert_filters`
- `quote_now_click_on_alert_card_event`

Screenshots confirm:

- Inbox / Saved / Deleted segmented tabs;
- map/location action;
- large live-load cards;
- company/trust identity;
- route block;
- vehicle and posted-time metadata;
- job state/payment tags;
- primary Quote action.

XDrive implementation rule:

- Live Loads must be an independent data pipeline.
- A profile/resources failure must never blank a successfully returned live-load list.

## 7. Load-card and job-detail decomposition

Compiled load UI modules include:

- load card content;
- load-with-stops route;
- load details screen;
- customer card;
- feedback card;
- vehicle details card;
- load chips;
- load description;
- load CTA button.

This matches the screenshots showing that the card and details screen are composed from independent sections rather than a single text blob.

XDrive target card structure:

1. poster/company/trust header;
2. posted time + vehicle;
3. factual status chips only;
4. numbered route block;
5. schedule information;
6. load/cargo summary;
7. distance where available;
8. primary action.

## 8. Quotes flow

The compiled app contains roughly 100 quote-related source modules and dedicated quote business objects/state.

Observed states/strings include:

- Submitted
- Unsuccessful
- Accepted
- quote request status
- Quote Now
- quote detail / quote input state

Screenshots confirm:

- Submitted / Unsuccessful segmented state;
- unsuccessful quote outcome card;
- quote entry form;
- currency;
- amount;
- additional extras;
- total;
- collect-within field;
- vehicle selection;
- notes;
- submit quote.

XDrive target:

- Submitted / Active
- Accepted / Awarded
- Unsuccessful / Closed
- Edit/withdraw only while business rules allow it
- Explicit quote value and job context
- Do not expose customer-private stop/contact data before allocation.

## 9. Bookings architecture

Bookings is by far the largest observed feature area.

Compiled modules explicitly include:

- booking card;
- bookings diary;
- booking details screen;
- booking summary view;
- booking stops view;
- booking statuses view;
- stop details screen;
- booking status details bottom sheet;
- delivered screen;
- loaded screen;
- on-site screen;
- booking signature screen;
- invoice webview;
- attachments;
- proof of delivery business object;
- booking/stop status persistence;
- offline/local booking stores.

Screenshots confirm top-level booking filters such as:

- Current
- Past 7 days
- Past 14 days

XDrive requirement:

- My Jobs must become a real booking/history product, not a flat list.
- Current and completed/history data need separate, stable views.

## 10. Summary / Stops / Status detail model

The screenshots and compiled module names align exactly with a three-view job detail pattern:

- Summary
- Stops
- Status

### Summary

Observed capabilities:

- company/reference header;
- Call;
- Message;
- route card;
- View on Map;
- distance/ETA;
- vehicle/equipment;
- notes;
- payments;
- attachments;
- View POD.

### Stops

Compiled modules include dedicated stop objects/screens and status models.

Screenshots confirm:

- sequential numbered stops;
- multi-stop jobs;
- collection/delivery/via stop types;
- site/company;
- time window;
- full address for allocated bookings;
- focused stop detail;
- copy-address action.

XDrive must support an arbitrary ordered stop array. A hard-coded pickup+delivery pair is insufficient.

### Status

Compiled modules include booking status and booking stop status metadata.

Screenshots confirm a vertical lifecycle timeline with completed ticks and timestamps.

XDrive canonical lifecycle remains:

1. Awarded / Allocated
2. Accepted where required
3. On My Way to Pickup
4. On Site Pickup
5. Loaded
6. On My Way to Delivery
7. On Site Delivery
8. Delivered / POD
9. Invoice/financial completion where applicable

## 11. POD, attachments and document capture

Static analysis confirms first-class modules for:

- proof of delivery;
- booking attachments;
- signatures;
- camera/image capture;
- document builder;
- document viewer;
- PDF support;
- native edge detection;
- OpenCV;
- PDFium;
- image processing native libraries.

Compiled analytics/event names indicate specific attachment actions across booking stages, including:

- on-site collection add document/image;
- loaded add document/image;
- on-site delivery add document/image;
- POD add document/image;
- POD received-by;
- delivery status;
- weight/items/packaging updates.

Screenshots confirm:

- Add Document;
- Add Image;
- multiple attachments;
- View POD;
- POD/status detail.

XDrive requirement:

- Evidence belongs to explicit lifecycle stages.
- Pickup evidence must be bound before Loaded when required.
- Delivery evidence/signature/receiver metadata must be bound before Delivered/POD where required.
- Offline queue acceptance is not equivalent to server-confirmed success.

## 12. Mapping and navigation

The extracted package includes:

- `libheresdk.so`
- HERE map assets and map-scene resources;
- map marker assets;
- route/distance/tracking assets;
- compiled map modules;
- explicit map app integrations/URIs.

Screenshots confirm:

- full route map;
- distance to collection;
- load distance;
- journey duration;
- suggested route based on traffic;
- route markers;
- zoom controls.

XDrive target:

- map screen is a dedicated route/navigation surface;
- route metrics should be server or map-provider derived, not invented;
- distance-to-pickup and journey distance should be separate concepts;
- coordinates/contact/address privacy must respect allocation status.

## 13. Background location/tracking

Android manifest strings confirm:

- fine location;
- coarse location;
- background location;
- foreground service;
- foreground service location;
- dedicated location tracking service;
- location availability/status broadcast receivers.

Compiled source modules include extensive location-tracking state, configuration and settings.

Implication for XDrive:

- tracking cannot be treated as a cosmetic toggle;
- it needs explicit runtime permission state, service state, user-visible state, backend state and recovery behaviour.

## 14. Messaging and communication

Static analysis confirms dedicated freight-messenger modules and Stream Chat integration strings.

Screenshots confirm Call and Message actions in allocated booking details.

XDrive target:

- only expose phone/message capabilities when authorization/privacy permits;
- messaging must be a first-class job-context channel when implemented;
- until a secure backend is actually available, the UI must not pretend chat works.

## 15. Local persistence / offline architecture

Native libraries and compiled modules confirm local/offline support components, including:

- Isar;
- Drift/SQLite-related storage;
- SQLCipher;
- offline manager modules;
- booking local data sources;
- local booking status entities;
- local attachment entities;
- network manager modules.

This explains why the benchmark can maintain complex booking state while remaining responsive.

XDrive implication:

- keep a scoped local queue/cache, but never allow local optimistic state to override server truth for financial, allocation, POD or irreversible lifecycle outcomes.

## 16. Push, notifications and background work

Static manifest/library evidence includes:

- Firebase Messaging;
- OneSignal;
- notification receivers/services;
- WorkManager/background services;
- notification counters.

XDrive target:

- push token registration;
- server-authenticated device binding;
- deep link into relevant job/quote/booking;
- unread counters;
- safe token refresh;
- no cross-account notification leakage.

## 17. Support and profile ecosystem

Compiled modules/assets also expose:

- profile;
- account documents;
- vehicle settings;
- customer support;
- legal;
- help;
- directory;
- SmartPay;
- Who's Nearby;
- Journeys;
- notification preferences;
- accessibility/settings areas.

This reinforces that `More` should be a structured utility hub rather than a generic dashboard dump.

## 18. Technology inventory confirmed from static package analysis

Confirmed technologies/components include:

- Flutter/Dart AOT
- Android native host (`MainActivity`, application class)
- HERE SDK
- Firebase services
- OneSignal
- Stream Chat-related integration
- Zendesk support components
- CameraX
- ML Kit barcode-related components
- OpenCV / image processing
- PDFium
- Isar
- SQLCipher
- local database/storage layers
- foreground/background location tracking services

This list is architectural evidence only. It is not an instruction to clone the same vendor stack in XDrive.

## 19. Core product lesson for XDrive

The benchmark's quality is not mainly its colours.

The strongest qualities are:

- fixed native shell;
- stable information architecture;
- modular feature ownership;
- dense but readable operational cards;
- clear status hierarchy;
- explicit booking lifecycle;
- multi-stop support;
- evidence/POD tied to lifecycle;
- route/navigation as a dedicated product surface;
- persistent/offline-aware state;
- clear empty states;
- large deterministic tap targets;
- fixed bottom navigation.

The current XDrive Preview must therefore be rebuilt structurally, not cosmetically.

## 20. XDrive visual boundary

Do not reproduce the Courier Exchange yellow/charcoal trade dress.

XDrive remains:

- background `#F4F6F8`
- cards `#FFFFFF`
- navy `#0B2F6B`
- royal blue `#1D57D8`
- secondary blue `#0E3FA9`
- orange `#F5A300` as sparse accent
- text `#1A1F2B`
- muted `#667085`
- border `#D8E0EA`

Status colours should be semantic, not brand-cloned.

## 21. Immediate implementation order for PR #510

1. Keep GOLDEN installed and untouched.
2. Keep Preview package side-by-side as `co.uk.xdrivelogistics.driver.preview`.
3. Separate Live Loads fetch from profile/resources bootstrap.
4. Replace the global shell ScrollView with:
   - fixed header/top control;
   - independently scrollable body;
   - fixed bottom nav.
5. Remove double-render/ghost-layer behaviour.
6. Build reusable XDrive components:
   - AppShell;
   - BottomNav;
   - SegmentedTabs;
   - LoadCard;
   - RouteBlock;
   - StatusChip;
   - EmptyState;
   - FixedActionBar;
   - JobDetailTabs;
   - StopTimeline;
   - StatusTimeline.
7. Rebuild Live Loads with real backend jobs.
8. Rebuild Quotes.
9. Rebuild My Jobs/Bookings with history filters.
10. Rebuild Summary/Stops/Status.
11. Add real multi-stop contract support.
12. Preserve server-confirmed POD/evidence semantics.
13. Add map/route surface only against a verified provider/backend contract.
14. Rebuild side-by-side Preview locally.
15. Run authenticated physical-device E2E.

## 22. Acceptance threshold

The next Preview is still rejected if any of the following remains true:

- page ghost/double layer visible;
- entire application shell moves as one scrollable document;
- bottom nav moves with body content;
- dark-first theme returns;
- Live Loads are empty while eligible backend jobs exist;
- Live Loads depend on unrelated resource/profile calls to succeed;
- multi-stop data is flattened to two stops;
- job lifecycle is visually ambiguous;
- POD/status can display success before server confirmation;
- private contact/address data leaks before allocation;
- CX visual identity or wording is copied.

Physical-device E2E remains mandatory before any production replacement decision.
