import { useRef, useState } from 'react'
import {
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGES_BUCKET,
  uploadProductImage
} from '../../lib/productImageUpload'

function formatMaxSize(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export default function ProductImageField({
  value,
  onChange,
  productName,
  disabled = false
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handlePickClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    setUploading(true)
    setError('')
    setStatus('')

    try {
      const publicUrl = await uploadProductImage(file, productName)
      onChange(publicUrl)
      setStatus(`Uploaded ${file.name} to ${PRODUCT_IMAGES_BUCKET}`)
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>Product Image</label>

      <div style={styles.actions}>
        <button
          type="button"
          style={{
            ...styles.button,
            opacity: disabled || uploading ? 0.7 : 1
          }}
          onClick={handlePickClick}
          disabled={disabled || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>

        <span style={styles.helper}>
          Recommended: square JPG, PNG, or WebP up to {formatMaxSize(MAX_PRODUCT_IMAGE_BYTES)}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <input
        style={styles.input}
        placeholder="https://... or upload directly"
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
      />

      <p style={styles.bucketNote}>
        Storage bucket: <strong>{PRODUCT_IMAGES_BUCKET}</strong>. Make sure this
        bucket exists in Supabase Storage and is public.
      </p>

      {status ? <p style={styles.success}>{status}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {value ? (
        <div style={styles.previewCard}>
          <img src={value} alt="Product preview" style={styles.previewImage} />
          <div style={styles.previewMeta}>
            <p style={styles.previewTitle}>Image preview</p>
            <p style={styles.previewUrl}>{value}</p>
            <button
              type="button"
              style={styles.clearButton}
              onClick={() => onChange('')}
              disabled={disabled}
            >
              Remove Image
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'center'
  },
  button: {
    padding: '10px 16px',
    background: '#1a1a2e',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '13px'
  },
  helper: {
    color: '#777',
    fontSize: '12px'
  },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #ddd',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    background: 'white'
  },
  bucketNote: {
    margin: 0,
    color: '#777',
    fontSize: '12px',
    lineHeight: '1.5'
  },
  success: {
    margin: 0,
    fontSize: '12px',
    color: '#0ea5e9',
    background: '#e0f2fe',
    padding: '8px 10px',
    borderRadius: '8px'
  },
  error: {
    margin: 0,
    fontSize: '12px',
    color: '#b6462a',
    background: '#fdebe6',
    padding: '8px 10px',
    borderRadius: '8px'
  },
  previewCard: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    border: '1px solid #eee',
    borderRadius: '12px',
    alignItems: 'center',
    background: '#fafafa'
  },
  previewImage: {
    width: '96px',
    height: '96px',
    objectFit: 'cover',
    borderRadius: '10px',
    flexShrink: 0,
    background: '#f0f0f0'
  },
  previewMeta: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  previewTitle: {
    margin: 0,
    fontWeight: '700',
    color: '#333'
  },
  previewUrl: {
    margin: 0,
    color: '#777',
    fontSize: '12px',
    wordBreak: 'break-all'
  },
  clearButton: {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    background: 'white',
    color: '#555',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px'
  }
}
