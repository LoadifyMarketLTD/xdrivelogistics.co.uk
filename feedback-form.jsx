import { useState } from 'react'

export function FeedbackForm() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return <p>Thank you for your feedback, {name || 'driver'}!</p>
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginBottom: 8 }}>
        <label>
          Name
          <input
            style={{ display: 'block', width: '100%' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>
          Feedback
          <textarea
            style={{ display: 'block', width: '100%' }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think about XDrive Logistics"
            rows={4}
            required
          />
        </label>
      </div>
      <button type="submit" className="cta">Send feedback</button>
    </form>
  )
}

export default FeedbackForm
