# ⚠️ Deprecated Backend (`backend/*`)

This Express backend is **deprecated** and is **not** part of the current production runtime path.

## Current production architecture

- The Next.js frontend (`app/*`) uses Supabase directly.
- Production build/deploy configuration does not run `backend/server.js`.

## Safety guard

`backend/server.js` now refuses to start unless:

```bash
ALLOW_DEPRECATED_BACKEND=true
```

This prevents accidental production usage of legacy API routes.

## Allowed use

Only temporary local legacy testing/migration checks, with explicit opt-in.

## Do not use for production

Do not wire production traffic to `backend/*` unless a formal migration plan and security review are completed.
