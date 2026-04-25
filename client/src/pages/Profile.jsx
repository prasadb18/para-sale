import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import { formatCurrency } from '../lib/storefront'

export default function Profile() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [referralCode,  setReferralCode]  = useState('')
  const [transactions,  setTransactions]  = useState([])
  const [claimInput,    setClaimInput]    = useState('')
  const [claiming,      setClaiming]      = useState(false)
  const [copyDone,      setCopyDone]      = useState(false)
  const [txLoading,     setTxLoading]     = useState(false)

  useEffect(() => {
    if (!user) return

    // Load wallet balance
    supabase.from('user_wallets').select('balance').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setWalletBalance(Number(data?.balance ?? 0)))

    // Load / generate referral code
    supabase.from('profiles').select('full_name, phone, referral_code').eq('id', user.id).single()
      .then(async ({ data }) => {
        setFullName(data?.full_name ?? '')
        setPhone(data?.phone ?? '')
        let code = data?.referral_code || ''
        if (!code) {
          code = user.id.replace(/-/g, '').slice(0, 8).toUpperCase()
          await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)
        }
        setReferralCode(code)
      })

    // Load last 10 wallet transactions
    setTxLoading(true)
    supabase.from('wallet_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setTransactions(data || []); setTxLoading(false) })
  }, [user])

  const startEditing = () => {
    setEditName(fullName)
    setEditPhone(phone)
    setEditing(true)
  }

  const saveProfile = async () => {
    if (!editName.trim()) {
      alert('Please enter your full name.')
      return
    }
    if (editPhone.trim() && !/^\d{10}$/.test(editPhone.trim())) {
      alert('Please enter a valid 10-digit phone number.')
      return
    }
    setSavingProfile(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: editName.trim(),
      phone: editPhone.trim() || null
    })
    setSavingProfile(false)
    if (error) {
      alert(error.message || 'Could not save your profile.')
      return
    }
    setFullName(editName.trim())
    setPhone(editPhone.trim())
    setEditing(false)
  }

  const deleteAccount = async () => {
    const confirmed = window.confirm('Delete your account and all linked data permanently? This cannot be undone.')
    if (!confirmed) return
    const doubleConfirmed = window.confirm(`Final confirmation for ${user.email}. Orders, bookings, addresses, and profile data will be erased.`)
    if (!doubleConfirmed) return
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      alert(error.message || 'Could not delete your account.')
      return
    }
    await signOut()
    navigate('/login')
  }

  const handleClaim = async () => {
    const code = claimInput.trim().toUpperCase()
    if (code.length < 4) return
    setClaiming(true)
    try {
      const { data } = await supabase.rpc('claim_referral', { p_code: code })
      if (data?.ok) {
        setWalletBalance(b => b + 50)
        setClaimInput('')
        alert('🎉 ₹50 added to your wallet!')
      } else {
        alert(data?.error || 'Could not claim referral.')
      }
    } catch { alert('Error — please try again.') }
    finally { setClaiming(false) }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {})
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  const shareCode = () => {
    const msg = `Use my referral code ${referralCode} on 1ShopStore to get ₹50 wallet credit! Shop hardware, electricals & plumbing delivered fast.`
    if (navigator.share) navigator.share({ text: msg }).catch(() => {})
    else { navigator.clipboard.writeText(msg).catch(() => {}); alert('Link copied!') }
  }

  if (!user) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">🔒</p>
          <h2 className="empty-state__title">Sign in to view your profile</h2>
          <button className="button button--primary" onClick={() => navigate('/login')}>Sign In</button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <h1 className="page-header__title" style={{ marginBottom: 24 }}>My Profile</h1>

      <div className="profile-card">
        <div className="profile-account-head">
          <div>
            <h2 className="profile-card__title">Account</h2>
            <p className="profile-account__meta">{user.email}</p>
            {phone ? <p className="profile-account__meta">Phone: {phone}</p> : null}
          </div>
          <button className="button button--secondary button--sm" onClick={startEditing}>
            Edit Profile
          </button>
        </div>

        {editing && (
          <div className="profile-edit-grid">
            <label className="field">
              <span>Full name</span>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </label>
            <div className="profile-edit-actions">
              <button className="button button--secondary button--sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="button button--primary button--sm" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wallet card */}
      <div className="profile-card">
        <h2 className="profile-card__title">💳 Wallet Balance</h2>
        <p className="profile-wallet__balance">{formatCurrency(walletBalance)}</p>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem', marginTop: 4 }}>
          Use wallet credits at checkout to save on your next order.
        </p>

        {/* Transactions */}
        {txLoading ? <p style={{ color: 'var(--text-soft)', marginTop: 16 }}>Loading transactions…</p> : (
          transactions.length > 0 && (
            <div className="wallet-txns" style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Recent Transactions</p>
              {transactions.map(tx => (
                <div key={tx.id} className="wallet-txn">
                  <span className="wallet-txn__desc">{tx.description}</span>
                  <span className={`wallet-txn__amount wallet-txn__amount--${tx.type}`}>
                    {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Referral card */}
      <div className="profile-card" style={{ marginTop: 20 }}>
        <h2 className="profile-card__title">🎁 Referral Program</h2>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
          Share your code — both you and your friend earn <strong>₹50</strong> when they join.
        </p>

        {referralCode && (
          <div className="referral-code-box">
            <span className="referral-code-box__code">{referralCode}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button button--secondary button--sm" onClick={copyCode}>
                {copyDone ? '✓ Copied' : 'Copy'}
              </button>
              <button className="button button--primary button--sm" onClick={shareCode}>
                Share
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>Claim a friend's code</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Enter referral code"
              value={claimInput}
              onChange={e => setClaimInput(e.target.value.toUpperCase())}
            />
            <button
              className="button button--primary"
              onClick={handleClaim}
              disabled={!claimInput.trim() || claiming}
            >
              {claiming ? '…' : 'Claim'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="profile-card" style={{ marginTop: 20 }}>
        <h2 className="profile-card__title">Quick Links</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[
            { label: '📋 My Orders', href: '/orders' },
            { label: '🛠️ My Bookings', href: '/my-bookings' },
            { label: '❤️ Wishlist', href: '/wishlist' },
            { label: '🏷️ Coupons', href: '/coupons' },
            { label: '🔔 Notification Preferences', href: '/notification-preferences' },
            { label: '🔒 Privacy Policy', href: '/privacy-policy' },
            { label: '🛟 Help & Support', href: '/help' },
          ].map(({ label, href }) => (
            <button key={href} className="profile-link-btn" onClick={() => navigate(href)}>
              {label} →
            </button>
          ))}
        </div>
      </div>

      <button
        className="button button--secondary"
        style={{ marginTop: 24, width: '100%' }}
        onClick={async () => { await signOut(); navigate('/login') }}
      >
        Sign Out
      </button>

      <button
        className="button button--secondary"
        style={{ marginTop: 12, width: '100%', borderColor: '#fecaca', color: '#b91c1c', background: '#fff5f5' }}
        onClick={deleteAccount}
      >
        Delete Account
      </button>
    </div>
  )
}
