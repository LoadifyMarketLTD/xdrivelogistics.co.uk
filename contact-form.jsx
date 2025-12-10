import { useState } from 'react'

export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    const mailto = `mailto:info@xdrivelogistics.co.uk?subject=${encodeURIComponent(
      'Website enquiry from ' + name
    )}&body=${encodeURIComponent(message + '\n\nFrom: ' + name + ' <' + email + '>')}`
    window.location.href = mailto
    setStatus('Opening mail client...')
  }

  return (
    <form onSubmit={onSubmit} className="contact-form" aria-label="Contact form">
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Message</label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          rows="5"
        />
      </div>

      <button type="submit" className="cta">Send message</button>

      {status && <p style={{ marginTop: 12, color: '#0b5ed7' }}>{status}</p>}
    </form>
  )
}
