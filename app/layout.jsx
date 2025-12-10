// app/page.jsx
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 space-y-16">
      {/* HERO */}
      <section className="grid gap-8 md:grid-cols-[1.6fr,1fr] items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/80 mb-2">
            UK Courier Exchange Platform
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            Smart load & job management
            <span className="text-amber-400"> for UK van drivers</span>.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl">
            XDrive Logistics conectează șoferii de van / Luton cu încărcături
            reale, rute optimizate și clienți serioși, într-un sistem similar
            cu Courier Exchange – dar construit pentru nevoile tale.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow hover:bg-amber-400 transition"
            >
              Get a same-day quote
            </a>
            <a
              href="#drivers"
              className="inline-flex items-center rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-100 hover:border-amber-400 hover:text-amber-300 transition"
            >
              View driver features
            </a>
          </div>
          <div className="mt-6 grid grid-cols-3 max-w-md gap-4 text-xs text-slate-400">
            <div>
              <div className="text-lg font-semibold text-amber-300">24/7</div>
              <div>Job tracking & alerts</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-300">UK-wide</div>
              <div>Same-day coverage</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-300">CX-style</div>
              <div>Load board workflow</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/60">
          <h2 className="text-sm font-semibold text-slate-100 mb-1">
            Quick booking
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Send us your job details and we&apos;ll reply with availability +
            price.
          </p>
          <ContactForm />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          How XDrive works
        </h2>
        <p className="text-sm text-slate-300 max-w-2xl">
          Platforma funcționează similar cu Courier Exchange: clienții postează
          încărcături, șoferii verifică job-urile disponibile, acceptă cursele
          potrivite și primesc toate detaliile de livrare în aplicație.
        </p>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-amber-300 mb-1">
              1. Post job
            </div>
            <p className="text-slate-200">
              Clientul trimite detalii: adresă de colectare / livrare, dimensiune
              marfă, timp de încărcare și deadline.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-amber-300 mb-1">
              2. Match with driver
            </div>
            <p className="text-slate-200">
              XDrive găsește cel mai apropiat șofer disponibil (Sprinter, Luton,
              small van) cu asigurările corecte.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-amber-300 mb-1">
              3. Track & proof
            </div>
            <p className="text-slate-200">
              Clientul vede statusul job-ului și primește POD / semnătură
              digitală după livrare.
            </p>
          </div>
        </div>
      </section>

      {/* DRIVERS */}
      <section id="drivers" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Built for UK courier drivers
        </h2>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate
