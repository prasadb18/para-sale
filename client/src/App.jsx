import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import './App.css'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Dashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/Orders'
import AdminProducts from './pages/admin/Products'
import NewProduct from './pages/admin/NewProduct'
import AdminCategories from './pages/admin/Categories'
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

export default function App() {
  const initAuth = useAuthStore(s => s.initAuth)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <Routes>
      <Route path="/" element={<StorefrontPage><Home /></StorefrontPage>} />
      <Route path="/products" element={<StorefrontPage><Products /></StorefrontPage>} />
      <Route path="/products/:categorySlug" element={<StorefrontPage><Products /></StorefrontPage>} />
      <Route path="/product/:id" element={<StorefrontPage><ProductDetail /></StorefrontPage>} />
      <Route path="/login" element={<StorefrontPage><Login /></StorefrontPage>} />
      <Route path="/cart" element={<StorefrontPage><Cart /></StorefrontPage>} />
      <Route path="/checkout" element={<StorefrontPage><Checkout /></StorefrontPage>} />
      <Route path="/orders" element={<StorefrontPage><ProtectedRoute><Orders /></ProtectedRoute></StorefrontPage>} />

      <Route path="/admin" element={<Admin><Dashboard /></Admin>} />
      <Route path="/admin/orders" element={<Admin><AdminOrders /></Admin>} />
      <Route path="/admin/products" element={<Admin><AdminProducts /></Admin>} />
      <Route path="/admin/products/new" element={<Admin><NewProduct /></Admin>} />
      <Route path="/admin/categories" element={<Admin><AdminCategories /></Admin>} />
    </Routes>
  )
}
