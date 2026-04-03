const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
})

const categoryPresets = [
  {
    match: ['electrical', 'wire', 'cable', 'lighting'],
    icon: '⚡',
    theme: 'sun',
    blurb: 'Power, lighting, and connection essentials'
  },
  {
    match: ['plumb', 'pipe', 'valve', 'sanitary', 'water'],
    icon: '💧',
    theme: 'sky',
    blurb: 'Flow-control fittings and utility parts'
  },
  {
    match: ['paint', 'chemical', 'adhesive', 'seal'],
    icon: '🪣',
    theme: 'berry',
    blurb: 'Finishes, coatings, and quick-fix supplies'
  },
  {
    match: ['tool', 'safety', 'fastener', 'hardware'],
    icon: '🧰',
    theme: 'mint',
    blurb: 'Daily use gear for crews and maintenance'
  }
]

const fallbackPresets = [
  {
    icon: '🛒',
    theme: 'sand',
    blurb: 'Popular items for repeat buying'
  },
  {
    icon: '🧱',
    theme: 'mint',
    blurb: 'Reliable inventory for active projects'
  },
  {
    icon: '📦',
    theme: 'sky',
    blurb: 'Stocked items ready for dispatch'
  },
  {
    icon: '🔧',
    theme: 'berry',
    blurb: 'Practical essentials with clear pricing'
  }
]

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0))
}

export function formatCategoryLabel(slug = '') {
  if (!slug) return 'Products'

  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function getDiscountPercent(price, mrp) {
  const actualPrice = Number(price || 0)
  const actualMrp = Number(mrp || 0)

  if (!actualMrp || actualMrp <= actualPrice) return 0

  return Math.round(((actualMrp - actualPrice) / actualMrp) * 100)
}

export function getCategoryMeta(category, index = 0) {
  const source = `${category?.slug || ''} ${category?.name || ''}`.toLowerCase()
  const preset = categoryPresets.find(({ match }) =>
    match.some(keyword => source.includes(keyword))
  )

  return preset || fallbackPresets[index % fallbackPresets.length]
}

export function getDeliveryMessage(stock) {
  const availableStock = Number(stock || 0)

  if (availableStock > 25) return 'Ready to dispatch'
  if (availableStock > 0) return 'Limited stock'

  return 'Currently unavailable'
}

export function getEtaByLocation(city = '') {
  const normalized = String(city).trim().toLowerCase()

  if (!normalized) return 'Estimated delivery 25-35 mins'
  if (normalized.includes('mumbai') || normalized.includes('delhi')) {
    return 'Estimated delivery 18-28 mins'
  }
  if (normalized.includes('bangalore') || normalized.includes('bengaluru')) {
    return 'Estimated delivery 20-30 mins'
  }
  if (normalized.includes('chennai') || normalized.includes('hyderabad')) {
    return 'Estimated delivery 22-32 mins'
  }

  return 'Estimated delivery 25-35 mins'
}
