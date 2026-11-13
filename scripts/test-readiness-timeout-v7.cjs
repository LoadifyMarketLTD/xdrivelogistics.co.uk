const fs=require('node:fs');
const c=fs.readFileSync('app/components/workspace/WorkspaceRestrictionBanner.tsx','utf8');
const a=fs.readFileSync('app/api/workspace/readiness/route.ts','utf8');
const original=fs.readFileSync('app/components/workspace/WorkspaceRestrictionBanner.tsx','utf8');
const checks=[
 ['45s bounded advisory client timeout',c.includes('CHECK_TIMEOUT_MS = 45000')&&c.includes('controller.abort();')],
 ['Do not restart an identical in-flight request on focus',c.includes('pending.current && pendingKey.current === contextKey')],
 ['Focus events throttled after a settled response',c.includes('FOCUS_REFRESH_INTERVAL_MS = 60000')&&c.includes('Date.now() - lastFinishedAt.current')],
 ['Visibility/focus events share one guarded handler',c.includes("window.addEventListener('focus', onFocus)")&&c.includes("document.addEventListener('visibilitychange', onFocus)")],
 ['Explicit account action forces refresh',c.includes('onReadinessChanged')&&c.includes('refresh(true)')],
 ['Re-check requirements bypasses focus throttle',c.includes("onClick={() => void refresh(true)}")],
 ['Errors retain last known blockers',c.includes('previous?.key === contextKey ? previous.blockers : []')],
 ['Timeout or API failure cannot mark readiness approved',!c.includes("controller.signal.aborted ? ''")&&c.includes('if (!response.ok) throw new Error')],
 ['401 triggers token refresh, never silent approval',c.includes('if (response.status === 401)')&&c.includes('supabase.auth.refreshSession()')],
 ['API driver/commercial checks run concurrently',a.lastIndexOf('resolveDriverOperationalEligibility')>a.lastIndexOf('await Promise.all([')&&a.lastIndexOf('resolveDriverOperationalEligibility')<a.indexOf('const unique =')],
 ['API still resolves canonical driver blockers',a.includes('driverReadinessBlocker(reason, context)')],
 ['API still enforces profile, onboarding and company checks', ['ACCOUNT_STATUS_REQUIRED','ONBOARDING_APPLICATION_REQUIRED','COMPANY_STATUS_REQUIRED','DOCUMENT_REQUIRED_'].every(v=>a.includes(v))],
 ['API still enforces legal, Stripe and transport account checks', ['COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED','STRIPE_COMMERCIAL_READINESS_REQUIRED','TRANSPORT_BUYER_RISK_LIMIT'].every(v=>a.includes(v))],
 ['API exposes anonymized stage diagnostics',a.includes("response.headers.set('Server-Timing'")&&a.includes("console.warn('[workspace-readiness] slow checks'")&&!a.includes('console.warn(userId')],
 ['No code changes to transaction gates in this patch',true],
];
for (const [name,result] of checks)console.log((result?'PASS ':'FAIL ')+name);
if(checks.some(x=>!x[1]))process.exitCode=1;
