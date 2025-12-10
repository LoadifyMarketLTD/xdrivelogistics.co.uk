The Netlify deploy errored, with the following guidance provided:

Diagnosis:
- [#L78-L88](#L78-L88) shows Next.js failing to compile because `app/layout.jsx` contains an unterminated string constant at the `className="rounded-xl border border-slate-800 bg-slate` declaration. The line is missing the rest of the string and its closing quote, causing an unexpected end-of-file.

Solution:
- Open `app/layout.jsx`, find the `<div className="rounded-xl border border-slate-800 bg-slate...">` block, and complete the string so it ends with a closing quote and closing tag, for example:

```jsx
<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
  {/* content */}
</div>
```

- Commit the fix and rerun `npm run build` (or trigger another Netlify build) to confirm the compilation succeeds.

The relevant error logs are:

Line 66: [96m[1m​[22m[39m
Line 67: [96m[1mbuild.command from netlify.toml                               [22m[39m
Line 68: [96m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 69: ​
Line 70: [36m$ npm run build[39m
Line 71: > xdrivelogistics@0.1.0 build
Line 72: > next build
Line 73:   [1m[38;2;173;127;168m▲ Next.js 14.2.3[39m[22m
Line 74:  [37m[1m [22m[39m Creating an optimized production build ...
Line 75:  [33m[1m⚠[22m[39m Found lockfile missing swc dependencies, run next locally to automatically patch
Line 76: [31mFailed to compile.
Line 77: [39m
Line 78: ./app/layout.jsx
Line 79: Error:
Line 80:   [31mx[0m Unterminated string constant
Line 81:      ,-[[36;1;4m/opt/build/repo/app/layout.jsx[0m:108:1]
Line 82:  [2m108[0m |           Built for UK courier drivers
Line 83:  [2m109[0m |         </h2>
Line 84:  [2m110[0m |         <div className="grid gap-4 md:grid-cols-2 text-sm">
Line 85:  [2m111[0m |           <div className="rounded-xl border border-slate-800 bg-slate
     : [31;1m                         ^^^^
Line 86:      `----

  [31mx[0m Unexpected eof
     ,-[[36;1;4m/opt/build/repo/app/layout.jsx[0m:109:1]
 [2m109[0m |         </h2>

Line 87: Caused by:
Line 88:     Syntax Error
Line 89: Import trace for requested module:
Line 90: ./app/layout.jsx
Line 91: > Build failed because of webpack errors
Line 92: [91m[1m​[22m[39m
Line 93: [91m[1m"build.command" failed                                        [22m[39m
Line 94: [91m[1m────────────────────────────────────────────────────────────────[22m[39m
Line 95: ​
Line 96:   [31m[1mError message[22m[39m
Line 97:   Command failed with exit code 1: npm run build
Line 98: ​
Line 99:   [31m[1mError location[22m[39m
Line 100:   In build.command from netlify.toml:
Line 101:   npm run build
Line 102: ​
Line 103:   [31m[1mResolved config[22m[39m
Line 104:   build:
Line 105:     command: npm run build
Line 106:     commandOrigin: config
Line 107:     environment:
Line 108:       - ADMIN_EMAIL
Line 109:       - DATABASE_URL
Line 118:       - SUPABASE_SERVICE_ROLE_KEY
Line 119:     publish: /opt/build/repo/.next
Line 120:     publishOrigin: config
Line 121:   plugins:
Line 122:     - inputs: {}
Line 123:       origin: ui
Line 124:       package: "@netlify/plugin-nextjs"
Line 125:     - inputs: {}
Line 126:       origin: ui
Line 127:       package: "@netlify/plugin-lighthouse"
Line 128: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 129: Failed during stage 'building site': Build script returned non-zero exit code: 2
Line 130: Failing build: Failed to build site
Line 131: Finished processing build request in 32.275s
