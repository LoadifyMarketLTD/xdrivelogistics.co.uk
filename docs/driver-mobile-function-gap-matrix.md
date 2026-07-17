# Driver Mobile Function Gap Matrix

## Scope
Comparison between reference function set (provided images) and current CDrive Driver Mobile implementation.

## Matrix

| Module | Reference Function | Current Status | Notes |
|---|---|---|---|
| Auth | Mobile login with remember/forgot/legal links | Partial | Functional login exists, UX parity pending. |
| Home | Status overview header with profile + tracking | Added (shell) | Added to active mobile variant as functional shell. |
| Home | Quick actions: Search, Who's Nearby, Journeys | Added (shell) | Added action chips in home screen. |
| Home | Product updates card (What's New) | Added (shell) | Added informational card + CTA button. |
| Navigation | Bottom persistent navigation (Home/Alerts/Quotes/Bookings/More) | Added (shell) | Added product-style bottom nav in variant. |
| Alerts | Inbox/Saved/Deleted tabs + load cards + Quote CTA | Added (shell) | Tabs and cards added, backend quote submit flow pending. |
| Quotes | Submitted/Unsuccessful tabs + empty states/history | Added (shell) | View shell added, backend quote lifecycle pending. |
| Bookings | Current/Past 7/Past 14 + booking cards + View POD | Added (shell) | Filters and cards added, historical query segmentation pending. |
| More/Account | Profile and identity/integration action | Added (shell) | Account section added with integration action placeholder. |
| More/Settings | Notification toggles + push + tracking options | Added (shell) | Local toggle state added; persistence/API sync pending. |
| More/Support | Help Centre/Support/What's New/Legal links | Added (shell) | Support entries added; route wiring pending. |
| Quotes Backend | Submit quote and track outcomes | Missing | Needs data model + API wiring. |
| Booking Backend | Time-range segmentation and POD retrieval | Missing | Needs dedicated booking query + POD endpoint/route. |
| Preferences Backend | Persist app settings/toggles | Missing | Needs profile preferences storage. |

## Next Implementation Pass
1. Wire Alerts Quote button to submit quote endpoint.
2. Add dedicated data model for submitted/unsuccessful quotes.
3. Add bookings queries by time range and POD detail viewer route.
4. Connect More > Support rows to internal pages.
5. Persist settings toggles to profile preferences.
