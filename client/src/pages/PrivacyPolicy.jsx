const LAST_UPDATED = 'April 18, 2026'
const CONTACT_EMAIL = 'prasadbadhan7@gmail.com'
const APP_NAME = '1ShopStore'
const COMPANY = 'Parasale'

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: [
      'Email address for account creation and login.',
      'Full name and mobile number for order and service delivery.',
      'Delivery address including flat, building, city, and pincode.',
      'Order history, service booking details, and device location when you actively use the location picker.'
    ]
  },
  {
    title: '2. How We Use Your Information',
    body: [
      'To process orders and service bookings.',
      'To contact you regarding deliveries, bookings, and account activity.',
      'To improve the experience and resolve issues.',
      'We do not sell, trade, or rent your personal information.'
    ]
  },
  {
    title: '3. Data Storage and Security',
    body: [
      'Your data is stored on Supabase and transmitted over HTTPS.',
      'Row Level Security is used so each user can access only their own records.',
      'Passwords are handled by Supabase authentication and are never stored in plain text.'
    ]
  },
  {
    title: '4. Third-Party Services',
    body: [
      'Supabase for database and authentication.',
      'Google Maps or geocoding providers when you use location features.',
      'Railway for backend API hosting.',
      'Razorpay for online payment processing.'
    ]
  },
  {
    title: '5. Guest Orders',
    body: [
      'You can place orders and book services without creating an account.',
      'In that case we collect only the details needed to fulfil the order.',
      'Guest data is not linked to a persistent user account unless you later create one.'
    ]
  },
  {
    title: '6. Data Retention',
    body: [
      'We retain data while your account is active and for accounting or legal compliance where needed.',
      'If you delete your account, your personal data, orders, bookings, and saved addresses are removed according to our backend deletion flow.'
    ]
  },
  {
    title: '7. Your Rights',
    body: [
      'You may access, correct, or delete your account data.',
      'You may withdraw consent to location usage at any time by stopping use of the feature or changing browser/device settings.',
      `For requests, contact us at ${CONTACT_EMAIL}.`
    ]
  },
  {
    title: '8. Changes to This Policy',
    body: [
      'We may update this policy from time to time.',
      'Updates will appear on this page with a revised last-updated date.'
    ]
  }
]

export default function PrivacyPolicy() {
  return (
    <div className="storefront-page shell">
      <section className="policy-hero">
        <p className="eyebrow">{APP_NAME}</p>
        <h1 className="page-header__title">Privacy Policy</h1>
        <p className="section-copy">Last updated: {LAST_UPDATED}</p>
      </section>

      <div className="policy-layout">
        <section className="policy-card">
          <p>
            {COMPANY} built {APP_NAME} to help customers order hardware, electricals, plumbing supplies,
            and technician services. This page explains what data we collect, how we use it, and the
            choices you have.
          </p>
          <p>
            If you have any privacy questions, contact {CONTACT_EMAIL}.
          </p>
        </section>

        {SECTIONS.map(section => (
          <section key={section.title} className="policy-card">
            <h2 className="policy-card__title">{section.title}</h2>
            {section.body.map(line => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
