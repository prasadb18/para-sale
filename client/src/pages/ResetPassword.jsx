import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)   // true once Supabase confirms recovery session
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link.
    // The URL hash contains the access_token which Supabase parses automatically.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Fallback: if already has an active session (token was auto-parsed on load)
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true)
      else {
        // Give it 2 seconds for the hash to be processed, then show invalid
        setTimeout(() => setInvalid(prev => prev || !ready), 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/'), 2500)
    }
  }

  if (invalid && !ready) {
    return (
      <div className="storefront-page shell">
        <div className="login-layout">
          <section className="login-card reveal" style={{ maxWidth: 420 }}>
            <div className="reset-success">
              <span className="reset-success__icon">⚠️</span>
              <p className="reset-success__title">Link expired or invalid</p>
              <p className="reset-success__sub">
                Password reset links expire after 1 hour. Request a new one from the sign-in page.
              </p>
              <button
                type="button"
                className="button button--primary button--full"
                style={{ marginTop: 12 }}
                onClick={() => navigate('/login')}
              >
                Back to sign in
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="storefront-page shell">
        <div className="login-layout">
          <section className="login-card reveal" style={{ maxWidth: 420 }}>
            <div className="reset-success">
              <span className="reset-success__icon">✅</span>
              <p className="reset-success__title">Password updated</p>
              <p className="reset-success__sub">You're being redirected to the store…</p>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="storefront-page shell">
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-soft)' }}>
          Verifying reset link…
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="login-layout">
        <section className="login-card reveal" style={{ maxWidth: 420 }}>
          <div className="login-card__brand">
            <span className="brand-mark__badge">1</span>
            <div>
              <strong>1ShopStore</strong>
              <p className="card-copy">Set a new password for your account.</p>
            </div>
          </div>

          <div>
            <h2 className="card-title">Choose a new password</h2>
            <p className="card-copy">Pick something strong — at least 6 characters.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span>New password</span>
              <input
                className="input"
                type="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
              />
            </label>

            <label className="field">
              <span>Confirm password</span>
              <input
                className="input"
                type="password"
                placeholder="Repeat your new password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
              />
            </label>

            {error ? <p className="error-banner">{error}</p> : null}

            <button
              type="submit"
              className="button button--primary button--full"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Update password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
