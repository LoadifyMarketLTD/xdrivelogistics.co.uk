import Hero from 'components/hero'
import ContactForm from 'components/contact-form'

export default function Home() {
  return (
    <>
      <Hero />

      <section id="services" className="section services">
        <h2>Our Services</h2>
        <div className="cards">
          <div className="card">
            <h3>Same-day courier</h3>
            <p>Fast, tracked delivery across your area.</p>
          </div>
          <div className="card">
            <h3>Nationwide logistics</h3>
            <p>Reliable deliveries with flexible scheduling.</p>
          </div>
          <div className="card">
            <h3>Dedicated fleet</h3>
            <p>Vans, Luton and heavy-load options available.</p>
          </div>
        </div>
      </section>

      <section id="why" className="section">
        <h2>Why Choose XDrive</h2>
        <ul>
          <li>Experienced drivers and fully insured vehicles</li>
          <li>Real-time tracking and customer support</li>
          <li>Competitive, transparent pricing</li>
        </ul>
      </section>

      <section id="contact" className="section contact">
        <h2>Contact Us</h2>
        <p>Call us or send a message to discuss your shipment.</p>
        <address>
          Danny Courier LTD<br/>
          101 Cornelian Street<br/>
          Blackburn, BB1 9QL, UK
        </address>
        <ContactForm />
      </section>
    </>
  )
}
