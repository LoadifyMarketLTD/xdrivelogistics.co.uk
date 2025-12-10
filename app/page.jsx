import Hero from '../components/hero'
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <div className="home">
      <Hero />

      <section id="services" className="section services">
        <h2>Our Services</h2>
        <div className="cards">
          <div className="card">
            <h3>Same-day courier</h3>
            <p>Fast, tracked delivery across the UK.</p>
          </div>
          <div className="card">
            <h3>Nationwide logistics</h3>
            <p>Scheduled routes and dedicated vehicles.</p>
          </div>
          <div className="card">
            <h3>Dedicated fleet</h3>
            <p>Luton vans, long wheel base, tail lift on request.</p>
          </div>
        </div>
      </section>

      <section id="why" className="section">
        <h2>Why choose XDrive</h2>
        <ul>
          <li>Experienced drivers and fully insured vehicles</li>
          <li>Real-time communication and reliable ETAs</li>
          <li>Flexible pricing for ad-hoc and contract work</li>
        </ul>
      </section>

      <section id="contact" className="section contact">
        <h2>Contact us</h2>
        <p>Send us your job details and we’ll get back with a quote.</p>

        <ContactForm />

        <address style={{ marginTop: 16 }}>
          Danny Courier LTD<br />
          101 Cornelian Street<br />
          Blackburn, BB1 9QL, UK
        </address>
      </section>
    </div>
  )
}
