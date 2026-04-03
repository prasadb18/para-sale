import { Link } from 'react-router-dom'

const shopLinks = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'All Products' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'My Orders' }
]

const policyNotes = [
  'Prices are shown in INR and delivery charges are calculated during checkout.',
  'Visible stock levels and product availability depend on current inventory.',
  'Product photos are representative and may be updated as the catalog grows.'
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="site-footer__grid">
          <section className="site-footer__brand">
            <span className="brand-mark__badge">P</span>
            <div>
              <h2>Parasale</h2>
              <p>
                A cleaner shopping app experience for hardware, utility, and
                repeat supply ordering.
              </p>
            </div>
          </section>

          <section>
            <h3 className="site-footer__title">Shop</h3>
            <nav className="site-footer__links" aria-label="Footer shop links">
              {shopLinks.map(link => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </section>

          <section>
            <h3 className="site-footer__title">Storefront Notes</h3>
            <div className="site-footer__notes">
              {policyNotes.map(note => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </section>

          <section>
            <h3 className="site-footer__title">Support</h3>
            <div className="site-footer__notes">
              <p>Email: <a href="mailto:support@parasales.com">support@parasales.com</a></p>
              <p>Phone / WhatsApp: <a href="tel:+919967763999">+91 9967763999</a></p>
              <p>Business hours: 9:30 AM to 9:30 PM</p>
              <p>Service area: Palava, Dombivli East</p>
            </div>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p>Legal / business name: Parasales</p>
          <p>Parasale storefront for hardware catalog browsing, checkout, admin product upload, and order tracking.</p>
        </div>
      </div>
    </footer>
  )
}
