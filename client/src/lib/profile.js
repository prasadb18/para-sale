import { supabase } from './supabase'

const toCleanText = (value, maxLength = 80) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)

const buildFallbackName = (user) => {
  const candidates = [
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.user_metadata?.display_name,
    user?.email?.split('@')[0]
  ]

  const name = candidates
    .map(candidate => toCleanText(candidate))
    .find(Boolean)

  return name || 'Parasale Customer'
}

export async function ensureProfile(user) {
  if (!user?.id) {
    return {
      error: new Error('Missing authenticated user.')
    }
  }

  const profilePayload = {
    id: user.id,
    full_name: buildFallbackName(user),
    phone: toCleanText(user?.phone || user?.user_metadata?.phone, 20) || null
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  return { error }
}
