import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="site-footer__grid">

          {/* Brand */}
          <section className="site-footer__brand">
            <img src="/logo.png" alt="1ShopStore" className="brand-logo brand-logo--footer" />
            <p>
              Hardware, electricals, paints & plumbing — delivered fast to
              Palava City and Dombivli East.
            </p>
            <div className="site-footer__contact">
              <a href="tel:+919967763999">📞 +91 99677 63999</a>
              <a href="https://wa.me/919967763999" target="_blank" rel="noreferrer">
                💬 WhatsApp us
              </a>
            </div>
          </section>

          {/* Shop */}
          <section>
            <h3 className="site-footer__title">Shop</h3>
            <nav className="site-footer__links" aria-label="Shop links">
              <Link to="/products">All Products</Link>
              <Link to="/products?filter=instock">In Stock</Link>
              <Link to="/products?filter=offer">On Offer</Link>
              <Link to="/cart">Cart</Link>
              <Link to="/orders">My Orders</Link>
            </nav>
          </section>

          {/* Policies */}
          <section>
            <h3 className="site-footer__title">Policies</h3>
            <nav className="site-footer__links" aria-label="Policy links">
              <span>Cash on Delivery available</span>
              <span>Free delivery on orders above ₹500</span>
              <span>7-day exchange on manufacturing defects</span>
              <span>Same-day dispatch for in-stock items</span>
            </nav>
          </section>

          {/* Support */}
          <section>
            <h3 className="site-footer__title">Support</h3>
            <nav className="site-footer__links" aria-label="Support links">
              <a href="mailto:support@1shopstore.com">support@1shopstore.com</a>
              <span>Mon – Sat, 9:30 AM – 9:30 PM</span>
              <span>Delivery zones: Palava · Dombivli East · Kalyan</span>
              <Link to="/login">Sign in / Create account</Link>
            </nav>
          </section>

        </div>

        <div className="site-footer__bottom">
          <p>© {year} 1ShopStore. All rights reserved.</p>
          <p>Prices in INR · Inclusive of all taxes</p>
        </div>
      </div>
    </footer>
  )
}
