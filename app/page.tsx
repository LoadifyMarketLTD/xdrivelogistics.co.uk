export default function Home() {
  return (
    <main>
      <header>
        <h1>Danny Courier LTD</h1>
        <p>Professional Courier and Logistics Services</p>
      </header>
      
      <section aria-labelledby="about-heading">
        <h2 id="about-heading">Welcome to Danny Courier LTD</h2>
        <p>
          We provide reliable courier and logistics services across the UK. 
          Our team is dedicated to delivering your parcels safely and on time, 
          every time.
        </p>
      </section>

      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Our Services</h2>
        <ul>
          <li><strong>Same Day Delivery:</strong> Urgent parcels delivered within hours</li>
          <li><strong>Next Day Delivery:</strong> Reliable overnight shipping</li>
          <li><strong>Business Solutions:</strong> Tailored logistics for companies</li>
          <li><strong>Secure Transport:</strong> Safe handling of valuable items</li>
        </ul>
      </section>

      <section aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact Us</h2>
        <p>
          Ready to get started? Get in touch with our team for a quote or 
          to discuss your delivery needs.
        </p>
        <address>
          <p>Email: <a href="mailto:info@dannycourierltd.co.uk">info@dannycourierltd.co.uk</a></p>
          <p>Phone: <a href="tel:+441234567890">+44 (0) 1234 567890</a></p>
        </address>
      </section>
    </main>
  )
}
