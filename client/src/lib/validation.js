const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const cityPattern = /^[A-Za-z][A-Za-z\s.'-]{1,59}$/
const pincodePattern = /^\d{6}$/

const normalizeSpace = (value = '') => value.trim().replace(/\s+/g, ' ')

export const normalizeEmail = (value = '') => value.trim().toLowerCase()

export const validateLoginForm = ({ email, password, isSignup = false }) => {
  const errors = {}
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    errors.email = 'Enter your email address.'
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password.trim()) {
    errors.password = 'Enter your password.'
  } else if (isSignup && password.length < 6) {
    errors.password = 'Password must be at least 6 characters.'
  }

  return {
    errors,
    normalizedEmail
  }
}

export const sanitizeAddressForm = (form) => ({
  label: normalizeSpace(form.label || 'Site') || 'Site',
  line1: normalizeSpace(form.line1),
  line2: normalizeSpace(form.line2),
  city: normalizeSpace(form.city),
  pincode: String(form.pincode || '').replace(/\D/g, '').slice(0, 6)
})

export const validateAddressForm = (form) => {
  const sanitizedForm = sanitizeAddressForm(form)
  const errors = {}

  if (!sanitizedForm.line1) {
    errors.line1 = 'Enter your address line 1.'
  } else if (sanitizedForm.line1.length < 8) {
    errors.line1 = 'Enter a fuller street, building, or landmark.'
  } else if (sanitizedForm.line1.length > 120) {
    errors.line1 = 'Address line 1 should stay under 120 characters.'
  }

  if (sanitizedForm.line2.length > 120) {
    errors.line2 = 'Address line 2 should stay under 120 characters.'
  }

  if (!sanitizedForm.city) {
    errors.city = 'Enter the city.'
  } else if (!cityPattern.test(sanitizedForm.city)) {
    errors.city = 'Use a valid city name.'
  }

  if (!sanitizedForm.pincode) {
    errors.pincode = 'Enter your 6-digit pincode.'
  } else if (!pincodePattern.test(sanitizedForm.pincode)) {
    errors.pincode = 'Pincode must be exactly 6 digits.'
  }

  return {
    errors,
    sanitizedForm
  }
}
