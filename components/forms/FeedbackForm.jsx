'use client'
import { useState } from 'react'

export default function FeedbackForm({ onFeedbackSent }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) {
      setStatus('Please enter your feedback before sending.')
      return
    }
    setStatus('Thank you — feedback submitted.')
    if (typeof onFeedbackSent === 'function') onFeedbackSent(text)
    setText('')
  }

  return (
    <form onSubmit={submit} className="feedback-form" aria-label="Feedback form">
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Feedback</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows="4" required placeholder="Your feedback" />
      </div>
      <button type="submit" className="cta">Send feedback</button>
      {status && <p style={{ marginTop: 12, color: '#0b5ed7' }}>{status}</p>}
    </form>
  )
}
