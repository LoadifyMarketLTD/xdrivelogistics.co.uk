'use client';

/** Isolated same-origin integration preview; driver API requires a valid bearer token. */
export default function OfficialDriverPwaLivePage() {
  return (
    <main style={{ margin: 0, width: '100%', minHeight: '100dvh' }}>
      <iframe
        title="XDrive Driver PWA authenticated integration preview"
        src="/driver/official-pwa/index.html?live=1"
        style={{ display: 'block', width: '100%', height: '100dvh', border: 0 }}
        referrerPolicy="same-origin"
      />
    </main>
  );
}
