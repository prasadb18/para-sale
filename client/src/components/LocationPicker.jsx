import { useEffect, useRef, useState } from 'react'
import useLocationStore from '../store/locationStore'

const PRESET_ZONES = [
  { label: 'Palava City', sublabel: 'Dombivli East, Thane' },
  { label: 'Dombivli East', sublabel: 'Thane District, Maharashtra' },
  { label: 'Dombivli West', sublabel: 'Thane District, Maharashtra' },
  { label: 'Kalyan East', sublabel: 'Thane District, Maharashtra' },
  { label: 'Kalyan West', sublabel: 'Thane District, Maharashtra' },
  { label: 'Ulhasnagar', sublabel: 'Thane District, Maharashtra' },
]

export default function LocationPicker({ onClose }) {
  const setLocation = useLocationStore(s => s.setLocation)
  const [query, setQuery] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const overlayRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Debounced Nominatim search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < 3) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&limit=6&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setSuggestions(data)
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const pick = (label, sublabel) => {
    setLocation({ label, sublabel })
    onClose()
  }

  const pickFromNominatim = (item) => {
    const addr = item.address || {}
    const label =
      addr.suburb || addr.neighbourhood || addr.village ||
      addr.town || addr.city_district || addr.city || item.display_name.split(',')[0]
    const sublabel =
      [addr.city || addr.town, addr.state_district || addr.county, addr.state]
        .filter(Boolean).join(', ')
    pick(label, sublabel)
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser.')
      return
    }
    setDetecting(true)
    setDetectError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const addr = data.address || {}
          const label =
            addr.suburb || addr.neighbourhood || addr.village ||
            addr.town || addr.city_district || addr.city || 'Your location'
          const sublabel =
            [addr.city || addr.town, addr.state_district || addr.county, addr.state]
              .filter(Boolean).join(', ')
          pick(label, sublabel)
        } catch {
          setDetectError('Could not fetch address. Please search manually.')
        } finally {
          setDetecting(false)
        }
      },
      (err) => {
        setDetecting(false)
        if (err.code === 1) setDetectError('Location access denied. Please allow it in your browser settings.')
        else setDetectError('Could not detect location. Please search manually.')
      },
      { timeout: 10000 }
    )
  }

  const filteredPresets = query.trim()
    ? PRESET_ZONES.filter(z =>
        z.label.toLowerCase().includes(query.toLowerCase()) ||
        z.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : PRESET_ZONES

  return (
    <div
      className="location-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="location-modal">
        <div className="location-modal__header">
          <h2 className="location-modal__title">Select delivery location</h2>
          <button type="button" className="location-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Search input */}
        <div className="location-modal__search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="location-modal__input"
            placeholder="Search for area, street name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="location-modal__clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Detect location */}
        <button
          type="button"
          className="location-modal__detect"
          onClick={detectLocation}
          disabled={detecting}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2"/>
          </svg>
          {detecting ? 'Detecting your location…' : 'Use current location'}
        </button>

        {detectError && (
          <p className="location-modal__error">{detectError}</p>
        )}

        {/* Nominatim search results */}
        {suggestions.length > 0 && (
          <div className="location-modal__section">
            <p className="location-modal__section-label">Search results</p>
            {suggestions.map((item) => {
              const addr = item.address || {}
              const label =
                addr.suburb || addr.neighbourhood || addr.village ||
                addr.town || addr.city_district || addr.city || item.display_name.split(',')[0]
              const sublabel = item.display_name.split(',').slice(1, 4).join(',').trim()
              return (
                <button
                  key={item.place_id}
                  type="button"
                  className="location-modal__item"
                  onClick={() => pickFromNominatim(item)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  <div>
                    <span className="location-modal__item-label">{label}</span>
                    <span className="location-modal__item-sub">{sublabel}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {searchLoading && (
          <p className="location-modal__searching">Searching…</p>
        )}

        {/* Preset / filtered zones */}
        {!searchLoading && (suggestions.length === 0) && (
          <div className="location-modal__section">
            <p className="location-modal__section-label">
              {query.trim() ? 'Matching zones' : 'Our delivery zones'}
            </p>
            {filteredPresets.length === 0 ? (
              <p className="location-modal__empty">No zones matched. Try searching above.</p>
            ) : (
              filteredPresets.map(zone => (
                <button
                  key={zone.label}
                  type="button"
                  className="location-modal__item"
                  onClick={() => pick(zone.label, zone.sublabel)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  <div>
                    <span className="location-modal__item-label">{zone.label}</span>
                    <span className="location-modal__item-sub">{zone.sublabel}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
