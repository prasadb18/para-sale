import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import { normalizeEmail, validateLoginForm } from '../lib/validation'
import { ensureProfile } from '../lib/profile'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { setUser, setSession } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event?.preventDefault()
    setError('')
    const { errors, normalizedEmail } = validateLoginForm({
      email,
      password,
      isSignup
    })

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setLoading(true)
    setEmail(normalizedEmail)

    const { data, error: authError } = isSignup
      ? await supabase.auth.signUp({ email: normalizedEmail, password })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data?.session) {
      const { error: profileError } = await ensureProfile(data.user)
      if (profileError) {
        setError(profileError.message || 'Could not prepare your customer profile.')
        setLoading(false)
        return
      }

      setSession(data.session)
      setUser(data.user)
      navigate('/')
    } else if (isSignup) {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        })

      if (signInData?.session) {
        const { error: profileError } = await ensureProfile(signInData.user)
        if (profileError) {
          setError(profileError.message || 'Could not prepare your customer profile.')
          setLoading(false)
          return
        }

        setSession(signInData.session)
        setUser(signInData.user)
        navigate('/')
      } else {
        setError(signInError?.message || 'Something went wrong')
      }
    }

    setLoading(false)
  }

  return (
    <div className="storefront-page shell">
      <div className="login-layout">
        <section className="login-spotlight reveal">
          <span className="chip chip--accent">1ShopStore account</span>
          <h1>Sign in to save addresses, track orders, and check out faster.</h1>
          <p>
            The new shopping-app UI works best when account details, delivery
            locations, and order history are all tied together.
          </p>

          <div className="info-list">
            <div className="info-list__item">
              <strong>Saved delivery addresses</strong>
              <span>Jump through checkout faster for site, home, or warehouse drops.</span>
            </div>
            <div className="info-list__item">
              <strong>Order visibility</strong>
              <span>Track pending, confirmed, dispatched, and delivered orders in one place.</span>
            </div>
            <div className="info-list__item">
              <strong>Repeat ordering flow</strong>
              <span>Revisit the same products with less friction on every purchase.</span>
            </div>
          </div>
        </section>

        <section className="login-card reveal">
          <div className="login-card__brand">
            <span className="brand-mark__badge">1</span>
            <div>
              <strong>1ShopStore</strong>
              <p className="card-copy">Customer access for the refreshed storefront.</p>
            </div>
          </div>

          <div>
            <h2 className="card-title">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="card-copy">
              {isSignup
                ? 'Set up your account to start shopping and saving addresses.'
                : 'Log in to continue with cart, checkout, and order tracking.'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span>Email</span>
              <input
                className={`input${fieldErrors.email ? ' input--invalid' : ''}`}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={120}
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  setFieldErrors((current) => ({ ...current, email: '' }))
                  setError('')
                }}
                onBlur={() => setEmail(normalizeEmail(email))}
              />
              {fieldErrors.email ? (
                <span className="field__message field__message--error">
                  {fieldErrors.email}
                </span>
              ) : null}
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className={`input${fieldErrors.password ? ' input--invalid' : ''}`}
                type="password"
                placeholder={isSignup ? 'At least 6 characters' : 'Enter your password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={isSignup ? 6 : undefined}
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  setFieldErrors((current) => ({ ...current, password: '' }))
                  setError('')
                }}
              />
              {fieldErrors.password ? (
                <span className="field__message field__message--error">
                  {fieldErrors.password}
                </span>
              ) : null}
            </label>

            {error ? <p className="error-banner">{error}</p> : null}

            <button
              type="submit"
              className="button button--primary button--full"
              disabled={loading}
            >
              {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            className="text-link"
            onClick={() => {
              setIsSignup(!isSignup)
              setError('')
              setFieldErrors({})
            }}
          >
            {isSignup
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>

          <div className="helper-note">
            Dev mode is using email and password right now. Switch back to your
            production auth approach before launch.
          </div>
        </section>
      </div>
    </div>
  )
}
