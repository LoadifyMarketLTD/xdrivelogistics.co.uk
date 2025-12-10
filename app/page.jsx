import Hero from '../components/hero'
import ContactForm from '../components/contact-form'

export default function Home() {
  return (
    <>
      <Hero />
      <section id="contact" style={{ padding: '40px 0' }}>
        <ContactForm />
      </section>
    </>
  )
}
