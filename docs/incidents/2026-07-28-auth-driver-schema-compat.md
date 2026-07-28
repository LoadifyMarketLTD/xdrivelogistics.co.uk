# Production auth incident — driver schema compatibility

Real Supabase project: `jqxlauexhkonixtjvljw`.

Production login returns PostgreSQL `42703` because the auth driver query requests `drivers.driver_type` and `drivers.can_commercial_bid`, but those optional commercial columns are absent from the current production schema.

Hotfix requirements:

- preserve the real Supabase project and all environment variables;
- make the auth lookup compatible with the legacy `drivers` schema;
- fail closed for genuine database errors;
- never grant commercial bidding when the optional columns are unavailable;
- no migration, RLS, UI, route, dependency, package or lockfile changes in this hotfix.
