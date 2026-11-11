(function () {
  if (!('serviceWorker' in navigator)) return;
  const swUrl = '/driver/official-pwa/sw.js';
  const scope = '/driver/official-pwa/';
  let reloaded = false;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloaded || !refreshing) return;
    reloaded = true;
    window.location.reload();
  });
  function registerAndCheck() {
    navigator.serviceWorker.register(swUrl, { scope: scope, updateViaCache: 'none' })
      .then(function (registration) {
        function check() {
          if (!navigator.onLine) return;
          registration.update().catch(function () {});
        }
        check();
        registration.addEventListener('updatefound', function () {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
            // Never interrupt a driver mid-action. Apply when the app becomes active again.
            if (document.visibilityState === 'visible') {
              refreshing = true;
              if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState !== 'visible') return;
          check();
          if (registration.waiting) {
            refreshing = true;
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
        window.addEventListener('online', check);
        window.addEventListener('pageshow', check);
      }).catch(function (error) { console.warn('PWA update registration failed', error); });
  }
  if (document.readyState === 'complete') registerAndCheck();
  else window.addEventListener('load', registerAndCheck, { once: true });
})();