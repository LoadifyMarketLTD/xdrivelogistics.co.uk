/** Route-level feedback while a Driver PWA tab is loading. */
export default function DriverLoading() {
  return <section className="xd-mobile-list" aria-busy="true" aria-label="Opening driver screen">
    <div className="xd-driver-route-skeleton" aria-hidden="true">
      <div className="xd-driver-route-skeleton__heading" />
      <div className="xd-driver-route-skeleton__card" />
      <div className="xd-driver-route-skeleton__card" />
    </div>
    <span className="sr-only">Opening screen</span>
  </section>;
}
