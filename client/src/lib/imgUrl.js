// Supabase Storage image transform API.
// Only applies to URLs that come from Supabase Storage (/storage/v1/object/public/).
// External URLs (e.g. direct links) are passed through unchanged.
// Docs: https://supabase.com/docs/guides/storage/serving/image-transformations

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || ''

function isSupabaseStorage(url) {
  return url && url.includes('/storage/v1/object/public/')
}

/**
 * Returns an optimised image URL.
 * @param {string} url        - Original image_url from the database
 * @param {object} opts
 * @param {number} opts.width   - Target width in px (default 400)
 * @param {number} opts.quality - JPEG/WebP quality 1–100 (default 75)
 */
export function imgUrl(url, { width = 400, quality = 75 } = {}) {
  if (!url) return ''
  if (!isSupabaseStorage(url)) return url

  // Replace /object/public/ with /render/image/public/ for the transform API
  const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')

  // Append transform params — Supabase serves WebP automatically when supported
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    format: 'origin' // let Supabase pick WebP/AVIF based on Accept header
  })

  // Preserve any existing query params (e.g. cache-busting tokens)
  const separator = renderUrl.includes('?') ? '&' : '?'
  return `${renderUrl}${separator}${params.toString()}`
}
