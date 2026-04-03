const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const app = express()
const jsonParser = express.json()
const webhookJsonParser = express.raw({ type: 'application/json' })
app.use(cors())
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/razorpay/webhook') {
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

app.get('/', (req, res) => res.json({ status: 'API is running' }))

app.get('/categories', async (req, res) => {
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

app.get('/products', async (req, res) => {
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

app.get('/products/:id', async (req, res) => {
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

app.post('/payments/razorpay/webhook', webhookJsonParser, async (req, res) => {
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

app.post('/payments/razorpay/order', async (req, res) => {
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

app.post('/payments/razorpay/verify', async (req, res) => {
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

const port = process.env.PORT || 3001

app.listen(port, () =>
  console.log(`Server running on port ${port}`)
)
