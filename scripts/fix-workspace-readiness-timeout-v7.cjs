const fs=require('node:fs');
const file='app/components/workspace/WorkspaceRestrictionBanner.tsx';
let text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
function replaceOne(oldText,newText){
  const matches=text.split(oldText).length-1;
  if(matches!==1)throw new Error('Expected 1 marker, got '+matches+': '+oldText.slice(0,80));
  text=text.replace(oldText,newText);
}
replaceOne(
  '  const pending = useRef<AbortController | null>(null);',
  `  const pending = useRef<AbortController | null>(null);
  const pendingKey = useRef<string | null>(null);
  const lastFinishedAt = useRef(0);
  const lastFinishedKey = useRef<string | null>(null);
  const timeoutTriggered = useRef(false);
  const CHECK_TIMEOUT_MS = 45000;
  const FOCUS_REFRESH_INTERVAL_MS = 60000;`
);
replaceOne(
  "  const refresh = useCallback(async () => {\n    const current = ++sequence.current;\n    pending.current?.abort();\n    if (!user?.id || role === 'platform_owner' || isRecoveryPage) { setSnapshot(null); setLoading(false); return; }\n    const controller = new AbortController();\n    pending.current = controller;\n    const timeout = window.setTimeout(() => controller.abort(), 20000);",
  `  const refresh = useCallback(async (force = false) => {
    if (!user?.id || role === 'platform_owner' || isRecoveryPage) {
      pending.current?.abort();
      pending.current = null;
      pendingKey.current = null;
      ++sequence.current;
      setSnapshot(null);
      setLoading(false);
      return;
    }
    // Focus and visibility are frequently emitted together. Neither should
    // abort and restart an in-flight advisory readiness verification.
    if (!force && pending.current && pendingKey.current === contextKey) return;
    if (!force && lastFinishedKey.current === contextKey &&
        Date.now() - lastFinishedAt.current < FOCUS_REFRESH_INTERVAL_MS) return;
    const current = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    pendingKey.current = contextKey;
    timeoutTriggered.current = false;
    // Cold starts, token refresh and multiple checks can exceed 20 seconds.
    // Never treat an unverified response as proof that restrictions were lifted.
    const timeout = window.setTimeout(() => {
      timeoutTriggered.current = true;
      controller.abort();
    }, CHECK_TIMEOUT_MS);`
);
replaceOne(
  "      if (current === sequence.current) setSnapshot({ key: contextKey, blockers: payload.blockers, error: '', unauthorized: false });",
  `      if (controller.signal.aborted) throw new Error('The requirements check was interrupted.');
      if (current === sequence.current) setSnapshot({ key: contextKey, blockers: payload.blockers, error: '', unauthorized: false });`
);
replaceOne(
  "        error: controller.signal.aborted ? 'The requirements check timed out. Please retry.' : reason instanceof Error ? reason.message : 'Your requirements could not be verified. Please retry.',",
  "        error: timeoutTriggered.current ? 'The requirements check timed out. Please retry.' : reason instanceof Error ? reason.message : 'Your requirements could not be verified. Please retry.',"
);
replaceOne(
  "      if (current === sequence.current) setLoading(false);",
  `      if (current === sequence.current) {
        pending.current = null;
        pendingKey.current = null;
        lastFinishedAt.current = Date.now();
        lastFinishedKey.current = contextKey;
        setLoading(false);
      }`
);
replaceOne(
  "    pending.current?.abort();\n  }, []);",
  `    pending.current?.abort();
    pending.current = null;
    pendingKey.current = null;
  }, []);`
);
replaceOne(
  `    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener(WORKSPACE_READINESS_CHANGED, onFocus);
    return () => {
      cancelPending();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener(WORKSPACE_READINESS_CHANGED, onFocus);
    };
  }, [refresh, pathname, cancelPending]);`,
  `    void refresh(true);
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onReadinessChanged = () => { if (document.visibilityState === 'visible') void refresh(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener(WORKSPACE_READINESS_CHANGED, onReadinessChanged);
    return () => {
      cancelPending();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener(WORKSPACE_READINESS_CHANGED, onReadinessChanged);
    };
  }, [refresh, cancelPending]);`
);
text=text.replaceAll('onClick={() => void refresh()}','onClick={() => void refresh(true)}');
fs.writeFileSync(file,text,'utf8');
console.log('Client advisory readiness requests de-duplicated and timeout made explicit.');
