import Hero from '../components/hero'
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <>
      <Hero />

      <section id="contact" className="section contact">
        <h2>Contact us</h2>
        <p>Send us details about your load and we will get back with a quote.</p>
        <ContactForm />
      </section>
    </>
  )
}
         
