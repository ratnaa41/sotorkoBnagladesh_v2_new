
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  return (
    <div className="page">
      <div
        className="card"
        style={{
          maxWidth: 480,
          margin: '40px auto',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: 10 }}>
          Password Reset
        </h2>

        <div
          style={{
            background: '#fff4e5',
            color: '#8a4b08',
            padding: '14px',
            borderRadius: 8,
            marginBottom: 18,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <strong>Password reset is temporarily unavailable.</strong>

          <p style={{ margin: '8px 0 0' }}>
            For security reasons, password reset requires
            a verified email-based reset process.
            This feature is not available yet.
          </p>
        </div>

        <p
          style={{
            fontSize: 13,
            color: '#666',
            marginBottom: 20,
          }}
        >
          If you already have an account and remember
          your current password, you can log in normally.
        </p>

        <Link
          to="/login"
          className="btn"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            textDecoration: 'none',
          }}
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}
