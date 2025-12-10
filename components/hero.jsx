export default function Hero() {
  return (
    <section className="w-full flex flex-col items-center justify-center text-center py-24 px-6">
      <h1 className="text-4xl md:text-6xl font-bold mb-6 text-brand">
        XDrive Logistics
      </h1>

      <p className="text-lg md:text-xl max-w-2xl text-muted mb-10">
        Reliable courier & logistics solutions across the UK — Danny Courier LTD
      </p>

      <a
        href="/contact"
        className="px-8 py-3 rounded-xl border border-brand-accent bg-brand-accent text-white font-medium hover:opacity-90 transition"
      >
        Get a Quote
      </a>
    </section>
  );
}
