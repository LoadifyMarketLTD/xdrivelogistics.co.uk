# PR #399 PAF runtime redeploy marker — 2026-08-29 23:44 UTC

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
PR: `#399 — CX-close operational workspace convergence`

Purpose: force a fresh canonical Netlify Deploy Preview after the server-only UK PAF/address-by-postcode environment key was configured in Netlify.

No secret value is recorded in this repository.

Runtime truth before this redeploy:
- postcode-address code uses `IDEAL_POSTCODES_API_KEY` with `GETADDRESS_API_KEY` fallback;
- Mapbox is not the source of truth for address-by-postcode;
- prior canonical deploy was green but was created before the PAF environment-key change;
- runtime postcode lookup remains NOT PASS until this post-config deploy is green and a real authenticated postcode lookup returns addresses.

Test postcode for browser verification: `BB1 9QL`.
