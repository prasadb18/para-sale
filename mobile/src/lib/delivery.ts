// Delivery date estimation
// Business hours: 9 AM – 6 PM, Monday – Saturday
// Cutoff for same-day dispatch: 2 PM
// Sunday: closed → next delivery is Monday

const CUTOFF_HOUR  = 14   // 2 PM
const DISPATCH_END = 20   // 8 PM (last drop-off)

function nextWorkingDay(from: Date): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  // Skip Sunday (0)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d
}

export interface DeliveryEstimate {
  label: string        // "Today, 22 Apr", "Tomorrow, 23 Apr", "Mon, 25 Apr"
  byTime: string       // "by 8 PM", "by 8 PM", ""
  isSameDay: boolean
}

export function getDeliveryEstimate(): DeliveryEstimate {
  const now      = new Date()
  const hour     = now.getHours()
  const weekday  = now.getDay()   // 0 Sun … 6 Sat
  const isSunday = weekday === 0

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  // Sunday — next delivery is Monday
  if (isSunday) {
    const monday = nextWorkingDay(now)
    return { label: fmt(monday), byTime: 'by 8 PM', isSameDay: false }
  }

  // Weekday / Saturday before cutoff → same-day
  if (hour < CUTOFF_HOUR) {
    return {
      label: 'Today, ' + now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      byTime: `by ${DISPATCH_END <= 12 ? DISPATCH_END : DISPATCH_END - 12} ${DISPATCH_END < 12 ? 'AM' : 'PM'}`,
      isSameDay: true,
    }
  }

  // After cutoff — next working day
  const tomorrow = nextWorkingDay(now)
  const isLiteralTomorrow =
    tomorrow.toDateString() === new Date(now.getTime() + 86_400_000).toDateString()

  return {
    label: isLiteralTomorrow
      ? 'Tomorrow, ' + tomorrow.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : fmt(tomorrow),
    byTime: 'by 8 PM',
    isSameDay: false,
  }
}

export function deliveryLabel(cartTotal: number): string {
  return cartTotal >= 500 ? 'Free' : '₹50'
}
