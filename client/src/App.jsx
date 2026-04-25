import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import './App.css'
import { initAnalytics, trackPageView } from './lib/analytics'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/Orders'
import AdminProducts from './pages/admin/Products'
import NewProduct from './pages/admin/NewProduct'
import AdminCategories from './pages/admin/Categories'
import AdminBookings from './pages/admin/Bookings'
import Technicians from './pages/admin/Technicians'
import Services from './pages/Services'
import MyBookings from './pages/MyBookings'
import Coupons from './pages/Coupons'
import HelpSupport from './pages/HelpSupport'
import Wishlist from './pages/Wishlist'
import Compare from './pages/Compare'
import Profile from './pages/Profile'
import Navbar from './components/Navbar'
import CartNotice from './components/CartNotice'
import InstallBanner from './components/InstallBanner'
import Footer from './components/Footer'
import AdminLayout from './components/AdminLayout'
import AdminRoute from './components/AdminRoute'
import useAuthStore from './store/authStore'

function ProtectedRoute({ children }) {
  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  if (!initialized) return null
  return user ? children : <Navigate to="/login" />
}

function Admin({ children }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  )
}

function StorefrontPage({ children }) {
  return (
    <div className="storefront-chrome">
      <Navbar />
      <InstallBanner />
      <CartNotice />
      <div className="storefront-stage">
        <div className="storefront-stage__inner">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  )
}

function PageTracker() {
  const location = useLocation()
  useEffect(() => { trackPageView(location.pathname) }, [location.pathname])
  return null
}

export default function App() {
  const initAuth = useAuthStore(s => s.initAuth)

  useEffect(() => {
    initAnalytics()
    initAuth()
  }, [initAuth])

  return (
    <Routes>
      <Route path="*" element={<PageTracker />} />
      <Route path="/" element={<StorefrontPage><Home /></StorefrontPage>} />
      <Route path="/products" element={<StorefrontPage><Products /></StorefrontPage>} />
      <Route path="/products/:categorySlug" element={<StorefrontPage><Products /></StorefrontPage>} />
      <Route path="/product/:id" element={<StorefrontPage><ProductDetail /></StorefrontPage>} />
      <Route path="/login" element={<StorefrontPage><Login /></StorefrontPage>} />
      <Route path="/reset-password" element={<StorefrontPage><ResetPassword /></StorefrontPage>} />
      <Route path="/cart" element={<StorefrontPage><Cart /></StorefrontPage>} />
      <Route path="/checkout" element={<StorefrontPage><Checkout /></StorefrontPage>} />
      <Route path="/orders" element={<StorefrontPage><ProtectedRoute><Orders /></ProtectedRoute></StorefrontPage>} />

      <Route path="/services" element={<StorefrontPage><Services /></StorefrontPage>} />
      <Route path="/my-bookings" element={<StorefrontPage><ProtectedRoute><MyBookings /></ProtectedRoute></StorefrontPage>} />
      <Route path="/coupons" element={<StorefrontPage><Coupons /></StorefrontPage>} />
      <Route path="/help" element={<StorefrontPage><HelpSupport /></StorefrontPage>} />
      <Route path="/wishlist" element={<StorefrontPage><Wishlist /></StorefrontPage>} />
      <Route path="/compare" element={<StorefrontPage><Compare /></StorefrontPage>} />
      <Route path="/profile" element={<StorefrontPage><ProtectedRoute><Profile /></ProtectedRoute></StorefrontPage>} />

      <Route path="/admin" element={<Admin><Dashboard /></Admin>} />
      <Route path="/admin/orders" element={<Admin><AdminOrders /></Admin>} />
      <Route path="/admin/products" element={<Admin><AdminProducts /></Admin>} />
      <Route path="/admin/products/new" element={<Admin><NewProduct /></Admin>} />
      <Route path="/admin/categories" element={<Admin><AdminCategories /></Admin>} />
      <Route path="/admin/bookings" element={<Admin><AdminBookings /></Admin>} />
      <Route path="/admin/technicians" element={<Admin><Technicians /></Admin>} />
    </Routes>
  )
}
