const fs=require('fs');
const p='app/api/workspace/readiness/route.ts';
let t=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
function replace(a,b){const n=t.split(a).length-1;if(n!==1)throw Error('Expected one marker, got '+n+' '+a.slice(0,80));t=t.replace(a,b)}
replace(
  "  const token = getBearerToken(request);",
  "  const startedAt = Date.now();\n  let identityMs = 0;\n  let companyMs = 0;\n  let onboardingMs = 0;\n  const token = getBearerToken(request);"
);
replace(
  "    if (profileResult.error || membershipResult.error) return json(503, { ready: false, error: 'Your account and company access could not be verified. Please retry.' });",
  "    identityMs = Date.now() - startedAt;\n    if (profileResult.error || membershipResult.error) return json(503, { ready: false, error: 'Your account and company access could not be verified. Please retry.' });"
);
replace(
  "    if (companyResult.error) return json(503, { ready: false, error: 'Company status could not be verified. Please retry.' });",
  "    companyMs = Date.now() - startedAt;\n    if (companyResult.error) return json(503, { ready: false, error: 'Company status could not be verified. Please retry.' });"
);
replace(
  "    if (companyId) {\n      if (!['active', 'approved'].includes(normal(companyResult.data?.status))) blockers.push(support(",
  "    onboardingMs = Date.now() - startedAt;\n    if (companyId) {\n      if (!['active', 'approved'].includes(normal(companyResult.data?.status))) blockers.push(support("
);
replace(
  "    return json(200, { ready: unique.length === 0, companyId, companyName: companyResult.data?.name ?? null,\n      role: context.role, checkedAt: new Date().toISOString(), advisory: true, blockers: unique });",
  `    const elapsedMs = Date.now() - startedAt;
    const commercialMs = elapsedMs - onboardingMs;
    // Record stage duration only: no user, company, session or document identifiers.
    if (elapsedMs > 8000) console.warn('[workspace-readiness] slow checks', {
      elapsedMs, identityMs, companyMs: companyMs - identityMs,
      onboardingMs: onboardingMs - companyMs, commercialMs,
    });
    const response = json(200, { ready: unique.length === 0, companyId, companyName: companyResult.data?.name ?? null,
      role: context.role, checkedAt: new Date().toISOString(), advisory: true, blockers: unique });
    response.headers.set('Server-Timing', [
      'identity;dur=' + identityMs,
      'company;dur=' + (companyMs - identityMs),
      'onboarding;dur=' + (onboardingMs - companyMs),
      'commercial;dur=' + commercialMs,
    ].join(', '));
    return response;`
);
fs.writeFileSync(p,t,'utf8');
console.log('Readiness endpoint stage timings instrumented without PII.');
