'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    const body = `${message}\n\nFrom: ${name} <${email}>`
    const mailto = `mailto:info@xdrivelogistics.co.uk?subject=${encodeURIComponent(
      'Website enquiry from ' + name
    )}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
    setStatus('Opening mail client...')
  }

  return (
    <form onSubmit={onSubmit} className="contact-form" aria-label="Contact form">
      <div className="field">
        <label>Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="field">
        <label>Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="field">
        <label>Message</label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What do you need to move?"
        />
      </div>

      <button type="submit" className="cta">Send message</button>

      {status && <p className="status">{status}</p>}
    </form>
  )
}
