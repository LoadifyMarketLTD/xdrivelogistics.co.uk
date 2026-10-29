# XDrive Demo transfer manifest — 2026-10-29

## Single source for the demo
- Browser: http://localhost:3117/try-xdrive-demo (local laptop only).
- Repo: D:\\XDrive-CX-Debug, branch preview/loads-cx-parity.
- Do not deploy or merge unrelated workspace changes with demo migration.

## Demo components to transfer together
- app/try-xdrive-demo/ and app/api/try-xdrive-demo/
- lib/try-xdrive-demo/
- Demo Post Load postcode UI: app/try-xdrive-demo/components/DemoPostcodeField.tsx
- Progressive postcode endpoint: app/api/try-xdrive-demo/postcode/route.ts
- Nearby street lookup: lib/try-xdrive-demo/nearbyStreets.ts
- Existing demo loads/quotes/bookings store and API dependencies must be audited before transplanting.

## Verified
- Demo localhost HTTP 200; postcode API BB19 HTTP 200 with 8 BB1 9xx suggestions.
- Browser Post Load: BB1 9QL -> Blackburn BB1, DA8 1NY -> Erith DA8.
- ESLint and TypeScript passed on touched demo files.

## Not yet verified / limitations
- Nearby street list for BB1 9QL currently empty in live demo test: OSM Overpass provider response has zero elements. No guarantee of street coverage; manual address entry remains essential. Do not claim postcode-to-PAF address parity.
- Demo public loads API is unauthenticated; private address fields must not be stored in public load records. Separate private post-award storage and access control are required before real platform migration.
- No authenticated real Post Load end-to-end verification and no production deployment.
- Repository contains extensive unrelated dirty files. Migration must use a reviewed file manifest and isolated changes, not mass git add.
