import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImageField from '../../components/admin/ProductImageField'
import { supabase } from '../../lib/supabase'

export default function NewProduct() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', brand: '',
    price: '', mrp: '', stock: '', unit: 'piece',
    category_id: '', image_url: '', is_active: true
  })

  useEffect(() => {
    supabase.from('categories').select('*')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value })
  })

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
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/admin/products')}>
          ← Back
        </button>
        <h2 style={styles.heading}>Add New Product</h2>
      </div>

      <div style={styles.form}>
        <div style={styles.group}>
          <label style={styles.label}>Product Name *</label>
          <input style={styles.input} placeholder="e.g. Havells 6A Switch" {...f('name')} />
        </div>
        <div style={styles.group}>
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }}
            placeholder="Brief description..." {...f('description')} />
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>Brand</label>
            <input style={styles.input} placeholder="e.g. Havells" {...f('brand')} />
          </div>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>Category *</label>
            <select style={styles.input} {...f('category_id')}>
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>Selling Price (₹) *</label>
            <input style={styles.input} type="number"
              placeholder="0.00" {...f('price')} />
          </div>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>MRP (₹)</label>
            <input style={styles.input} type="number"
              placeholder="0.00" {...f('mrp')} />
          </div>
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>Stock *</label>
            <input style={styles.input} type="number"
              placeholder="0" {...f('stock')} />
          </div>
          <div style={{ ...styles.group, flex: 1 }}>
            <label style={styles.label}>Unit</label>
            <select style={styles.input} {...f('unit')}>
              <option>piece</option>
              <option>metre</option>
              <option>kg</option>
              <option>litre</option>
              <option>box</option>
              <option>roll</option>
              <option>bag</option>
            </select>
          </div>
        </div>
        <div style={styles.group}>
          <ProductImageField
            value={form.image_url}
            onChange={imageUrl => setForm({ ...form, image_url: imageUrl })}
            productName={form.name}
            disabled={loading}
          />
        </div>

        <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Adding...' : '+ Add Product'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '20px', maxWidth: '540px', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' },
  back: { background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '15px', color: '#555' },
  heading: { margin: 0, fontSize: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '4px' },
  group: { display: 'flex', flexDirection: 'column', marginBottom: '12px' },
  row: { display: 'flex', gap: '12px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#555',
    marginBottom: '6px' },
  input: { padding: '11px 14px', border: '1.5px solid #ddd',
    borderRadius: '10px', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', width: '100%', background: 'white' },
  submitBtn: { padding: '14px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '12px', fontSize: '16px',
    fontWeight: '700', cursor: 'pointer', marginTop: '8px' }
}
