import { supabase } from './supabase'

export const PRODUCT_IMAGES_BUCKET =
  import.meta.env.VITE_PRODUCT_IMAGES_BUCKET || 'product-images'

export const MAX_PRODUCT_IMAGE_BYTES = 4 * 1024 * 1024

function slugify(value = 'product') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'product'
}

function getExtension(filename = '') {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg'
}

export async function uploadProductImage(file, productName = 'product') {
  if (!file) {
    throw new Error('Select an image to upload')
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Only image files can be uploaded')
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('Image must be 4 MB or smaller')
  }

  const filePath = `products/${Date.now()}-${slugify(productName)}.${getExtension(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (uploadError) {
    throw new Error(uploadError.message || 'Upload failed')
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}
