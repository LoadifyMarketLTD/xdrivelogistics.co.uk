import Hero from '../components/hero'
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <>
      <Hero />

      <section id="services" className="section services" aria-label="Services">
        <div className="container">
          <h2>Our Services</h2>
          <div className="cards">
            <div className="card">
              <h3>Same-day courier</h3>
              <p>Fast, tracked delivery across your area for urgent parcels.</p>
            </div>
            <div className="card">
              <h3>Nationwide logistics</h3>
              <p>Reliable scheduling and full tracking across the UK.</p>
            </div>
            <div className="card">
              <h3>Dedicated fleet</h3>
              <p>Vans, Luton and heavy-load options with insured drivers.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="section" aria-label="Why choose us">
        <div className="container">
          <h2>Why Choose XDrive</h2>
          <ul>
            <li>Experienced drivers and fully insured vehicles</li>
            <li>Real-time tracking and responsive customer support</li>
            <li>Transparent pricing and flexible scheduling</li>
          </ul>
        </div>
      </section>

      <section id="contact" className="section contact" aria-label="Contact">
        <div className="container">
          <h2>Contact Us</h2>
          <p>Call us or send a message to discuss your shipment.</p>
          <address>
            Danny Courier LTD<br/>
            101 Cornelian Street<br/>
            Blackburn, BB1 9QL, UK
          </address>

          <div style={{marginTop:18}}>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  )
}
