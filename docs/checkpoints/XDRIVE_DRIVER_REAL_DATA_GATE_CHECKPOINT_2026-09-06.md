# XDrive Driver V3 — Real Data Physical Gate Checkpoint — 2026-09-06

## Canonical parent
- PR #510 — `Driver phone GOLDEN recovery and modernization`
- Branch: `driver/phone-golden-20260718-modernization`
- PR remains DRAFT / NOT MERGED.
- GOLDEN package remains `co.uk.xdrivelogistics.driver`.
- Canonical GOLDEN SHA-256 remains `81f0e825a5899c90c34cd6a34af8104ce37c8be42ca4b3dcf9a7b978ee916f74`.
- Preview package remains `co.uk.xdrivelogistics.driver.preview`.
- GitHub Actions remain excluded from validation.
- No Production DB migration and no Netlify Production deploy are authorised.

## Physical visual state already confirmed
- Preview V3 is installed side-by-side on Pixel `57311FDCQ00BGS`.
- Login ghost/double-layer gate: PASS on physical device.
- Authenticated Overview render: PASS.
- Fixed shell: PASS by physical-device confirmation.
- V3 visual differentiation from CX is materially improved:
  - `Overview / Loads / Offers / History / Account`
  - `Load Board`
  - `Available / Starred / Dismissed`
  - `Offers: Active / Won / Archived`
  - full chronological `History`, no date-range buckets
  - `Work Order / Overview / Route / Progress`
  - `COLLECT → DELIVER` route grammar
  - XDrive Driver Control header and operational rail
  - Account list architecture instead of the prior More tile grid
- Do not make additional visual changes until real marketplace cards are rendered and reviewed.

## Real-data blocker found on physical device
The Load Board displayed the server error:

`Could not embed because more than one relationship was found for 'jobs' and 'companies'`

This is not an empty-data condition. Read-only Production inspection confirmed six unawarded `posted` exchange jobs exist.

### Root cause
`app/api/driver/mobile/nearby-jobs/route.ts` used an implicit PostgREST embed:

`companies(name,company_number)`

The schema has multiple `jobs → companies` foreign-key paths. The owning-company relationship must be explicitly selected via:

`companies:companies!jobs_company_id_fkey(name,company_number)`

### Repo fix
Commit `a1e0bc5a8209f9209c04caa6cc34e41628440982`:
- disambiguates the company embed using `jobs_company_id_fkey`;
- adds the already-typed `job_distance_minutes` field to the select;
- fixes the `Approx. area Â·` mojibake to `Approx. area ·`.

## Netlify Preview disposition
A Deploy Preview for the exact backend fix was automatically started on the canonical `xdrivelogistics` Netlify site, but failed in the site build stage before publication with exit code 2.
- This was NOT a Production deploy.
- Production was not changed.
- Do not use the failed Deploy Preview as runtime evidence.

## Local real-data bridge
To validate real Production data without merging or deploying Production, the side-by-side Preview may temporarily call a local Next.js backend from the isolated worktree via `adb reverse`.

Preview-only Android network support was added:
- build.gradle sets `xdriveUsesCleartextTraffic=true` only when `XDRIVE_SIDE_BY_SIDE_PREVIEW=true`;
- normal/GOLDEN builds set it to false;
- AndroidManifest consumes the placeholder through `android:usesCleartextTraffic`.

Commits:
- `7e2bc8810f3ee19fd04d1139c17e7d6405a5b90b`
- `7dc229b13c19300d1465d980d71d2669e063cad5`

This bridge is Preview-only and is for physical E2E validation against the real XDrive Supabase data. It does not modify Production deployment state.

## Next gate
1. Run local Next backend from isolated `C:\Users\Danny\xg-preview-gate` using existing local XDrive environment configuration.
2. Use `adb reverse` from Pixel to the local backend.
3. Build Preview with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:<gate-port>` and `XDRIVE_SIDE_BY_SIDE_PREVIEW=true`.
4. Verify Preview identity and canonical GOLDEN SHA before/after install.
5. Open authenticated `Loads` and capture real marketplace cards.
6. Review card composition against CX only after real data is visible.
7. Continue Offers → History → lifecycle/POD/offline/tracking/deep-link physical gates.
8. No final PASS until all physical evidence and owner visual approval are complete.
