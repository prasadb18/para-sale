import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_install_dismissed') === '1'
  )

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setPrompt(null)
    }
  }

  const dismiss = () => {
    localStorage.setItem('pwa_install_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div className="install-banner">
      <div className="install-banner__icon">
        <img src="/icons/icon-72x72.png" alt="" width={36} height={36} />
      </div>
      <div className="install-banner__text">
        <strong>Add 1ShopStore to your home screen</strong>
        <span>Get faster access and offline browsing</span>
      </div>
      <button type="button" className="install-banner__btn" onClick={install}>
        Install
      </button>
      <button type="button" className="install-banner__close" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}
