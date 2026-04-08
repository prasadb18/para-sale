import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImageField from '../../components/admin/ProductImageField'
import { supabase } from '../../lib/supabase'

const UNITS = ['piece', 'metre', 'kg', 'litre', 'box', 'roll', 'bag']

export default function NewProduct() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', brand: '', spec: '',
    price: '', mrp: '', stock: '', unit: 'piece',
    category_id: '', image_url: '', is_active: true
  })

  useEffect(() => {
    supabase.from('categories').select('*')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.stock || !form.category_id) {
      alert('Please fill name, price, stock and category')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('products').insert({
      ...form,
      price: parseFloat(form.price),
      mrp: form.mrp ? parseFloat(form.mrp) : null,
      stock: parseInt(form.stock)
    })
    setLoading(false)
    if (error) alert('Error: ' + error.message)
    else navigate('/admin/products')
  }

  return (
    <div className="admin-products-page">
      <div className="admin-page-header">
        <div>
          <button className="admin-back-btn" onClick={() => navigate('/admin/products')}>
            ← Back to Products
          </button>
          <h1 className="admin-page-title" style={{ marginTop: 6 }}>Add New Product</h1>
        </div>
      </div>

      <div className="admin-new-product-layout">
        {/* Left — main fields */}
        <div className="admin-form-card">
          <h3 className="admin-form-section-title">Product Details</h3>

          <div className="field">
            <span>Product Name <span style={{ color: '#e53935' }}>*</span></span>
            <input className="input" placeholder="e.g. Havells 6A Switch" value={form.name} onChange={set('name')} />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <span>Description</span>
            <textarea
              className="input"
              style={{ height: 90, resize: 'vertical' }}
              placeholder="Brief product description..."
              value={form.description}
              onChange={set('description')}
            />
          </div>

          <div className="admin-form-row" style={{ marginTop: 12 }}>
            <div className="field">
              <span>Brand</span>
              <input className="input" placeholder="e.g. Havells" value={form.brand} onChange={set('brand')} />
            </div>
            <div className="field">
              <span>Category <span style={{ color: '#e53935' }}>*</span></span>
              <select className="input" value={form.category_id} onChange={set('category_id')}>
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <span>Spec <span style={{ color: 'var(--text-soft)', fontWeight: 400, fontSize: '0.8rem' }}>(short technical detail shown on card — e.g. 15A · 240V)</span></span>
            <input className="input" placeholder="e.g. 15A, 240V  or  2.5 sq mm  or  100W E27" value={form.spec} onChange={set('spec')} />
          </div>
        </div>

        {/* Right — pricing, stock, image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="admin-form-card">
            <h3 className="admin-form-section-title">Pricing & Stock</h3>

            <div className="admin-form-row">
              <div className="field">
                <span>Selling Price (₹) <span style={{ color: '#e53935' }}>*</span></span>
                <input className="input" type="number" placeholder="0.00" value={form.price} onChange={set('price')} />
              </div>
              <div className="field">
                <span>MRP (₹)</span>
                <input className="input" type="number" placeholder="0.00" value={form.mrp} onChange={set('mrp')} />
              </div>
            </div>

            <div className="admin-form-row" style={{ marginTop: 12 }}>
              <div className="field">
                <span>Stock <span style={{ color: '#e53935' }}>*</span></span>
                <input className="input" type="number" placeholder="0" value={form.stock} onChange={set('stock')} />
              </div>
              <div className="field">
                <span>Unit</span>
                <select className="input" value={form.unit} onChange={set('unit')}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Active (visible to customers)</span>
              </label>
            </div>
          </div>

          <div className="admin-form-card">
            <h3 className="admin-form-section-title">Product Image</h3>
            <ProductImageField
              value={form.image_url}
              onChange={imageUrl => setForm(prev => ({ ...prev, image_url: imageUrl }))}
              productName={form.name}
              disabled={loading}
            />
          </div>

          <button
            className="button button--primary button--full"
            style={{ padding: 14, fontSize: '1rem', borderRadius: 10 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Adding...' : '+ Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
