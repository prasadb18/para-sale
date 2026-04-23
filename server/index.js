const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') })
const { createClient } = require('@supabase/supabase-js')

const app = express()
const router = express.Router()
const jsonParser = express.json()
const webhookJsonParser = express.raw({ type: 'application/json' })
app.use(cors())
router.use((req, res, next) => {
  if (req.path === '/payments/razorpay/webhook') {
    return next()
  }

  return jsonParser(req, res, next)
})

// Debug: confirm env vars are loading
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ loaded' : '✗ MISSING')
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ loaded' : '✗ MISSING')
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? '✓ loaded' : '✗ MISSING')
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? '✓ loaded' : '✗ MISSING')
console.log(
  'RAZORPAY_WEBHOOK_SECRET:',
  process.env.RAZORPAY_WEBHOOK_SECRET ? '✓ loaded' : '✗ MISSING'
)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

const razorpayKeyId = process.env.RAZORPAY_KEY_ID
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

const hasRazorpayConfig = () => Boolean(razorpayKeyId && razorpayKeySecret)
const hasRazorpayWebhookConfig = () => Boolean(razorpayWebhookSecret)

const createRazorpayAuthHeader = () => `Basic ${Buffer.from(
  `${razorpayKeyId}:${razorpayKeySecret}`
).toString('base64')}`

const isValidCheckoutAmount = (amount) =>
  Number.isInteger(amount) && amount >= 100

const toSafeNotes = (notes = {}) =>
  Object.fromEntries(
    Object.entries(notes)
      .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim())
      .slice(0, 15)
      .map(([key, value]) => [key, `${value}`.slice(0, 255)])
  )

const createHexSignature = (payload, secret) =>
  crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

const signaturesMatch = (expected, actual) => {
  if (!expected || !actual) return false

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

const isMissingOrderPaymentColumnError = (error) =>
  /razorpay_|payment_gateway|paid_at|payment_gateway_payload/i.test(error?.message || '')

const buildRazorpayPaymentPayload = ({
  event,
  orderId,
  paymentId,
  paymentStatus,
  amount,
  currency,
  payload
}) => ({
  event,
  orderId,
  paymentId,
  paymentStatus,
  amount,
  currency,
  receivedAt: new Date().toISOString(),
  payload
})

const syncRazorpayOrderRecord = async ({
  event,
  orderId,
  paymentId,
  paymentStatus,
  amount,
  currency,
  payload
}) => {
  if (!orderId) {
    return { matched: 0 }
  }

  const update = {
    payment_method: 'razorpay',
    payment_gateway: 'razorpay',
    razorpay_order_id: orderId,
    payment_gateway_payload: buildRazorpayPaymentPayload({
      event,
      orderId,
      paymentId,
      paymentStatus,
      amount,
      currency,
      payload
    })
  }

  if (paymentId) {
    update.razorpay_payment_id = paymentId
  }

  if (paymentStatus) {
    update.payment_status = paymentStatus
  }

  if (paymentStatus === 'paid') {
    update.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('orders')
    .update(update)
    .eq('razorpay_order_id', orderId)
    .select('id')

  if (error) {
    throw error
  }

  return { matched: data?.length || 0 }
}

router.get('/', (req, res) => res.json({ status: 'API is running' }))

router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')

    if (error) {
      console.error('Supabase error on /categories:', error)
      return res.status(500).json({ error: error.message, details: error })
    }

    res.json(data)
  } catch (err) {
    console.error('Unexpected error on /categories:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/products', async (req, res) => {
  try {
    const { category, search } = req.query
    const trimmedSearch = search?.trim()

    const applySearchFilter = (query) => {
      if (!trimmedSearch) return query

      const safeSearch = trimmedSearch
        .replace(/[%]/g, '')
        .replace(/[,()]/g, ' ')

      return query.or(
        `name.ilike.%${safeSearch}%,brand.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`
      )
    }

    if (category) {
      const { data: categoryRecord, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .maybeSingle()

      if (categoryError) {
        console.error('Supabase error on /products category lookup:', categoryError)
        return res.status(500).json({ error: categoryError.message, details: categoryError })
      }

      if (!categoryRecord) {
        return res.json([])
      }

      const query = applySearchFilter(
        supabase
          .from('products')
          .select('*, categories(name, slug)')
          .eq('is_active', true)
          .eq('category_id', categoryRecord.id)
      )

      const { data, error } = await query

      if (error) {
        console.error('Supabase error on /products:', error)
        return res.status(500).json({ error: error.message, details: error })
      }

      return res.json(data)
    }

    const query = applySearchFilter(
      supabase
        .from('products')
        .select('*, categories(name, slug)')
        .eq('is_active', true)
    )

    const { data, error } = await query

    if (error) {
      console.error('Supabase error on /products:', error)
      return res.status(500).json({ error: error.message, details: error })
    }

    res.json(data)
  } catch (err) {
    console.error('Unexpected error on /products:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', req.params.id)
      .single()

    if (error) {
      console.error('Supabase error on /products/:id:', error)
      return res.status(500).json({ error: error.message, details: error })
    }

    res.json(data)
  } catch (err) {
    console.error('Unexpected error on /products/:id:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/payments/razorpay/webhook', webhookJsonParser, async (req, res) => {
  if (!hasRazorpayWebhookConfig()) {
    return res.status(500).json({
      error: 'Razorpay webhook secret is not configured on the server.'
    })
  }

  const webhookSignature = req.get('x-razorpay-signature')
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')

  if (!webhookSignature || rawBody.length === 0) {
    return res.status(400).json({
      error: 'Missing webhook signature or payload.'
    })
  }

  const expectedSignature = createHexSignature(rawBody, razorpayWebhookSecret)

  if (!signaturesMatch(expectedSignature, webhookSignature)) {
    return res.status(400).json({
      error: 'Webhook signature verification failed.'
    })
  }

  let eventBody

  try {
    eventBody = JSON.parse(rawBody.toString('utf8'))
  } catch (error) {
    return res.status(400).json({
      error: 'Webhook payload is not valid JSON.'
    })
  }

  const event = eventBody?.event
  const paymentEntity = eventBody?.payload?.payment?.entity
  const orderEntity = eventBody?.payload?.order?.entity
  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id
  const razorpayPaymentId = paymentEntity?.id
  const paymentStatus =
    event === 'payment.failed'
      ? 'failed'
      : paymentEntity?.status === 'captured' || event === 'payment.captured' || event === 'order.paid'
        ? 'paid'
        : paymentEntity?.status || orderEntity?.status || 'unpaid'

  try {
    const result = await syncRazorpayOrderRecord({
      event,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      paymentStatus,
      amount: paymentEntity?.amount ?? orderEntity?.amount,
      currency: paymentEntity?.currency ?? orderEntity?.currency,
      payload: eventBody
    })

    return res.json({
      received: true,
      matchedOrders: result.matched
    })
  } catch (error) {
    if (isMissingOrderPaymentColumnError(error)) {
      console.error('Orders table is missing Razorpay columns:', error)
      return res.status(500).json({
        error: 'Orders table is missing Razorpay payment columns. Run the SQL patch first.'
      })
    }

    console.error('Unexpected Razorpay webhook error:', error)
    return res.status(500).json({
      error: error.message || 'Unexpected Razorpay webhook error.'
    })
  }
})

router.post('/payments/razorpay/order', async (req, res) => {
  if (!hasRazorpayConfig()) {
    return res.status(500).json({
      error: 'Razorpay is not configured on the server.'
    })
  }

  const {
    amount,
    currency = 'INR',
    receipt,
    notes
  } = req.body || {}

  if (!isValidCheckoutAmount(amount)) {
    return res.status(400).json({
      error: 'Order amount must be at least 100 paise.'
    })
  }

  try {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: createRazorpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `${receipt || `psl_${Date.now()}`}`.slice(0, 40),
        notes: toSafeNotes(notes)
      })
    })

    const payload = await razorpayResponse.json()

    if (!razorpayResponse.ok) {
      console.error('Razorpay order creation failed:', payload)
      return res.status(500).json({
        error: payload?.error?.description || 'Could not create Razorpay order.'
      })
    }

    return res.json({
      key: razorpayKeyId,
      order: payload
    })
  } catch (error) {
    console.error('Unexpected Razorpay order error:', error)
    return res.status(500).json({
      error: error.message || 'Unexpected Razorpay order error.'
    })
  }
})

router.post('/payments/razorpay/verify', async (req, res) => {
  if (!hasRazorpayConfig()) {
    return res.status(500).json({
      error: 'Razorpay is not configured on the server.'
    })
  }

  const {
    orderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature
  } = req.body || {}

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      error: 'Missing payment verification fields.'
    })
  }

  const generatedSignature = createHexSignature(
    `${orderId}|${razorpayPaymentId}`,
    razorpayKeySecret
  )

  const isVerified =
    signaturesMatch(generatedSignature, razorpaySignature) &&
    orderId === razorpayOrderId

  if (!isVerified) {
    return res.status(400).json({
      error: 'Payment verification failed.'
    })
  }

  return res.json({
    verified: true
  })
})

// ── Push notification helpers ─────────────────────────────────────────────────
const EXPO_PUSH_URL = 'https://exp.host/--/exponent-push-notifications/v2/push/send'

const sendExpoPush = async (token, title, body, data = {}) => {
  if (!token?.startsWith('ExponentPushToken')) return { ok: false, reason: 'invalid token' }
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  })
  return res.json()
}

const ORDER_MESSAGES = {
  confirmed:  { title: 'Order Confirmed! 📦', body: 'Your order has been confirmed and is being prepared.' },
  dispatched: { title: 'Out for Delivery! 🚚', body: 'Your order is on its way to you.' },
  delivered:  { title: 'Order Delivered! ✅', body: 'Your order has been delivered. Enjoy!' },
  cancelled:  { title: 'Order Cancelled', body: 'Your order has been cancelled.' },
}

const BOOKING_MESSAGES = {
  confirmed: { title: 'Booking Confirmed! 🛠️', body: 'Your technician booking has been confirmed.' },
  assigned:  { title: 'Technician Assigned! 👷', body: 'A technician has been assigned to your booking.' },
  completed: { title: 'Service Completed! ✅', body: 'Your service booking has been marked as completed.' },
  cancelled: { title: 'Booking Cancelled', body: 'Your technician booking has been cancelled.' },
}

// POST /api/notifications/order-update  — called by Supabase Database Webhook
router.post('/notifications/order-update', jsonParser, async (req, res) => {
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET
  if (webhookSecret) {
    const incomingSecret = req.get('x-webhook-secret') || req.get('authorization')?.replace('Bearer ', '')
    if (incomingSecret !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const { record, old_record, table } = req.body || {}
  if (!record) return res.json({ sent: false, reason: 'no record' })

  const statusChanged = record.status !== old_record?.status
  if (!statusChanged) return res.json({ sent: false, reason: 'status unchanged' })

  const userId = record.user_id
  if (!userId) return res.json({ sent: false, reason: 'guest — no push token' })

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single()

    const token = profile?.push_token
    if (!token) return res.json({ sent: false, reason: 'no push token' })

    const messages = table === 'service_bookings' ? BOOKING_MESSAGES : ORDER_MESSAGES
    const msg = messages[record.status]
    if (!msg) return res.json({ sent: false, reason: `no message for status: ${record.status}` })

    const screen = table === 'service_bookings' ? 'MyBookings' : 'Orders'
    const result = await sendExpoPush(token, msg.title, msg.body, { screen })
    return res.json({ sent: true, result })
  } catch (err) {
    console.error('[notifications/order-update] error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications/send  — manual / test send
router.post('/notifications/send', async (req, res) => {
  const { token, title, body, data } = req.body || {}
  if (!token || !title || !body) {
    return res.status(400).json({ error: 'token, title and body are required' })
  }
  try {
    const result = await sendExpoPush(token, title, body, data)
    res.json({ sent: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Product Variants ──────────────────────────────────────────────────────────

// GET /api/products/:id/variants
router.get('/products/:id/variants', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, attribute_name, value, price, mrp, stock, sku, sort_order')
    .eq('product_id', id)
    .order('sort_order', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── Product Reviews ───────────────────────────────────────────────────────────

// GET /api/products/:id/reviews
router.get('/products/:id/reviews', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, rating, review_text, reviewer_name, created_at, user_id')
    .eq('product_id', id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/products/:id/reviews/summary
router.get('/products/:id/reviews/summary', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('product_reviews')
    .select('rating')
    .eq('product_id', id)
  if (error) return res.status(500).json({ error: error.message })

  const count = data.length
  const avg = count ? Math.round((data.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  data.forEach(r => { dist[r.rating] = (dist[r.rating] || 0) + 1 })
  res.json({ avg, count, dist })
})

// POST /api/products/:id/reviews
router.post('/products/:id/reviews', async (req, res) => {
  const { id } = req.params
  const { user_id, rating, review_text, reviewer_name } = req.body || {}
  if (!user_id || !rating) return res.status(400).json({ error: 'user_id and rating required' })
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' })
  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      { product_id: id, user_id, rating, review_text: review_text || null, reviewer_name: reviewer_name || 'User' },
      { onConflict: 'product_id,user_id' }
    )
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/products/:id/reviews/:reviewId
router.delete('/products/:id/reviews/:reviewId', async (req, res) => {
  const { reviewId } = req.params
  const { user_id } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  const { error } = await supabase
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', user_id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: true })
})

app.use('/api', router)

const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const port = process.env.PORT || 3001

app.listen(port, '0.0.0.0', () =>
  console.log(`Server running on port ${port}`)
)
