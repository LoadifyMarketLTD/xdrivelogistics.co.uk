# Fresh Driver PWA — LOADS API contract (source inspected 2026-10-26)

Only LOADS is in scope. The CX screenshots define presentation geometry, not backend field names. Do not expose full postcodes before award.

| Feature | Actual file | Endpoint | Method | Input | Output | Auth / permission | Error | Test | Status |
|---|---|---|---|---|---|---|---|---|---|
| Available jobs | `app/api/driver/marketplace/loads/route.ts` | `/api/driver/marketplace/loads` | GET | Optional `id`, `view` query | `{loads: [...]}`; public town/outcode, slots, vehicle, cargo, payment, member, myBid | `requireWebDriver`; `canCommercialBid` | 403, 503, operational errors | Authenticated E2E pending | SOURCE VERIFIED, E2E UNVERIFIED |
| Single job | `app/api/driver/marketplace/loads/route.ts` | `/api/driver/marketplace/loads?id=<jobId>` | GET | `id` | `{loads:[...]}` filtered to available job | same | unavailable / error | Pending | SOURCE VERIFIED, E2E UNVERIFIED |
| Submit quote | `app/api/driver/bids/route.ts`, `app/api/driver/_lib/submitQuote.ts` | `/api/driver/bids` | POST | `{jobId:string,amount:number,baseAmount:number,additionalExtrasGbp:number,message:string}` | `{success:true,bidId,jobId}` | `requireWebDriver`; server quote policy in `submitDriverQuote` | `{error,denialReasons,code,setupUrl,actionLabel}` | Pending, do not submit live test quotes | SOURCE VERIFIED, E2E UNVERIFIED |

### Presentation reference contract
Blueprint V2.1, pp. 9-11: reference image `55020.png` and `cx_mobile_measured_reference_extended`; composite raster sizes: header 709x106, summary 709x204, route 709x245, notes 709x121, quote button 675x85, bottom nav 709x103, input 681x48. These are image pixels **not** CSS pixels. Must measure viewport, DPR, crop and bounding boxes before claiming pixel parity. Light mode, minimum 44x44 CSS px targets, immediate touch feedback, no blank map space, map only in details. Do not copy CX branding.

### Required remaining work
Implement actual Body Type and radius filtering only if supported by real data, show cargo/dimensions/handling in details, quote permission and duplicate state, expired/awarded filtering, offline/retry, map with failure fallback, role and accessibility checks, reference-image visual calibration. No OPPO testing per latest user instruction. No production mutation or push.
