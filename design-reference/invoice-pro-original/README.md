# Invoice Pro original UI reference

These files are copied verbatim from the local XDrive Invoice Pro Working 20261028 folder for visual/markup parity during integration. They are NOT served by Next.js, are not wired to Supabase and must not be treated as a production finance workflow. Preserve the original design rather than recolouring the 3118 demo. Do not load the legacy standalone localStorage invoice database as if it were the source of truth. Use authenticated tenant-scoped XDrive records, and verify real billing operations before enabling writes.
