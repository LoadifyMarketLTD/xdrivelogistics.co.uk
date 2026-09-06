# XDrive Driver Hosted Preview Gate — 2026-09-06

Canonical PR: #510
Branch: `driver/phone-golden-20260718-modernization`

Purpose: force a fresh canonical Netlify deploy-preview after the deploy-preview-only hosted device-session isolation flag was configured, without changing Production or the GOLDEN APK.

Validated facts before this checkpoint:
- Hosted Netlify runtime reaches Supabase project `jqxlauexhkonixtjvljw` successfully.
- Hosted service-role can read feature flags, jobs, bids, and Supabase Admin Auth.
- `driver_mobile_app` is enabled.
- Local `netlify dev:exec` is not authoritative for the masked service-role secret and must not be used as the physical mobile real-data backend.
- Physical Preview must use `https://deploy-preview-510--xdrivelogistics.netlify.app`.
- Preview package is `co.uk.xdrivelogistics.driver.preview`.
- Hosted Preview device-session bypass is restricted to the Preview package, Netlify deploy-preview hostname, staging app environment, and deploy-preview-only environment flag.
- Canonical GOLDEN package/session registry must remain untouched by Preview testing.

No Production DB migration.
No Netlify Production deploy.
No merge of PR #510.
No GOLDEN overwrite/uninstall.
