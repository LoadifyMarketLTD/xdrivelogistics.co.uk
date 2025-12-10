import { useState } from 'react'

export function FeedbackForm() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    if (!message.trim()) {
      setStatus('Please enter your feedback before sending.')
      return
    }
    setStatus('Thank you for your feedback!')
    setMessage('')
  }

  return (
    <form onSubmit={onSubmit} className="feedback-form">
      <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
        Feedback
      </label>
      <textarea
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tell us what went well or what we can improve."
        style={{ width: '100%', marginBottom: 8 }}
      />
      <button type="submit" className="cta">
        Send feedback
      </button>
      {status && <p style={{ marginTop: 8 }}>{status}</p>}
    </form>
  )
}
