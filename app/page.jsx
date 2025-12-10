import Hero from '../components/hero'
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <>
      <Hero />

      <section id="services" className="section services">
        <h2>Our Services</h2>
        <div className="cards">
          <div className="card">
            <h3>Same‑day courier</h3>
            <p>Urgent deliveries collected and delivered the same day anywhere in the UK.</p>
          </div>
          <div className="card">
            <h3>Nationwide logistics</h3>
            <p>Planned routes, multi‑drop and dedicated vehicles for your business.</p>
          </div>
          <div className="card">
            <h3>Dedicated fleet</h3>
            <p>Vans, Luton and tail‑lift vehicles ready for pallets, freight and bulky loads.</p>
          </div>
        </div>
      </section>

      <section id="why" className="section">
        <h2>Why choose XDrive</h2>
        <ul>
          <li>Experienced, vetted drivers and fully‑insured vehicles</li>
          <li>Flexible day and night collections</li>
          <li>Transparent, competitive pricing</li>
        </ul>
      </section>

      <section id="contact" className="section contact">
        <h2>Request a quote</h2>
        <p>Tell us what you need to move and we&apos;ll come back with a clear price and schedule.</p>
        <ContactForm />
      </section>
    </>
  )
}
