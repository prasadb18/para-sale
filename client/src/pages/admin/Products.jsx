import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImageField from '../../components/admin/ProductImageField'
import { supabase } from '../../lib/supabase'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories()])
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*')
    setCategories(data || [])
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      mrp: product.mrp || '',
      stock: product.stock,
      brand: product.brand || '',
      unit: product.unit,
      category_id: product.category_id,
      image_url: product.image_url || '',
      is_active: product.is_active
    })
  }

  const saveEdit = async (id) => {
    await supabase.from('products').update({
      ...form,
      price: parseFloat(form.price),
      mrp: form.mrp ? parseFloat(form.mrp) : null,
      stock: parseInt(form.stock, 10)
    }).eq('id', id)
    setEditingId(null)
    fetchProducts()
  }

  const toggleActive = async (id, current) => {
    await supabase.from('products')
      .update({ is_active: !current }).eq('id', id)
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, is_active: !current } : p
    ))
  }

  const deleteProduct = async (id) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const visible = products.filter(p => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)
  })

  if (loading) return <p style={{ padding: '40px', textAlign: 'center' }}>Loading...</p>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Products ({products.length})</h2>
        <button style={styles.addBtn}
          onClick={() => navigate('/admin/products/new')}>
          + Add Product
        </button>
      </div>

      <input
        style={styles.searchInput}
        placeholder="Search by name or brand..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {visible.map(product => (
        <div key={product.id} style={{
          ...styles.card,
          opacity: product.is_active ? 1 : 0.6
        }}>
          {editingId === product.id ? (
            <div style={styles.editForm}>
              <div style={styles.editGrid}>
                <div style={styles.fullWidth}>
                  <ProductImageField
                    value={form.image_url}
                    onChange={imageUrl => setForm({ ...form, image_url: imageUrl })}
                    productName={form.name}
                  />
                </div>
                <div>
                  <label style={styles.label}>Name</label>
                  <input style={styles.input} value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>Brand</label>
                  <input style={styles.input} value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>Price (₹)</label>
                  <input style={styles.input} type="number" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>MRP (₹)</label>
                  <input style={styles.input} type="number" value={form.mrp}
                    onChange={e => setForm({ ...form, mrp: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>Stock</label>
                  <input style={styles.input} type="number" value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>Unit</label>
                  <select style={styles.input} value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}>
                    <option>piece</option>
                    <option>metre</option>
                    <option>kg</option>
                    <option>litre</option>
                    <option>box</option>
                    <option>roll</option>
                    <option>bag</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Category</label>
                  <select style={styles.input} value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={styles.editActions}>
                <button style={styles.saveBtn} onClick={() => saveEdit(product.id)}>
                  Save Changes
                </button>
                <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.productRow}>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={styles.thumb}
                />
              ) : (
                <div style={styles.thumbPlaceholder}>📦</div>
              )}
              <div style={styles.productInfo}>
                <p style={styles.productName}>{product.name}</p>
                <p style={styles.productMeta}>
                  {product.categories?.name} · {product.brand || 'No brand'}
                </p>
                <div style={styles.productStats}>
                  <span style={styles.pill}>₹{product.price}</span>
                  <span style={{
                    ...styles.pill,
                    background: product.stock > 5 ? '#e8f5e9' : '#fce4ec',
                    color: product.stock > 5 ? '#27ae60' : '#e91e63'
                  }}>
                    {product.stock} {product.unit}s
                  </span>
                </div>
              </div>
              <div style={styles.productActions}>
                <button style={styles.editBtn} onClick={() => startEdit(product)}>
                  Edit
                </button>
                <button
                  style={{
                    ...styles.toggleBtn,
                    background: product.is_active ? '#fce4ec' : '#e8f5e9',
                    color: product.is_active ? '#e91e63' : '#27ae60'
                  }}
                  onClick={() => toggleActive(product.id, product.is_active)}
                >
                  {product.is_active ? 'Hide' : 'Show'}
                </button>
                {deletingId === product.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={{ ...styles.toggleBtn, background: '#e91e63', color: 'white' }}
                      onClick={() => deleteProduct(product.id)}>
                      Confirm
                    </button>
                    <button style={styles.editBtn} onClick={() => setDeletingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button style={{ ...styles.toggleBtn, background: '#f5f5f5', color: '#999' }}
                    onClick={() => setDeletingId(product.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const styles = {
  page: { padding: '20px', maxWidth: '680px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px' },
  heading: { fontSize: '20px', margin: 0 },
  addBtn: { padding: '10px 20px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    fontWeight: '700', fontSize: '14px' },
  card: { border: '1px solid #eee', borderRadius: '14px',
    marginBottom: '10px', overflow: 'hidden', background: 'white' },
  productRow: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '14px 16px' },
  thumb: { width: '72px', height: '72px', borderRadius: '12px',
    objectFit: 'cover', marginRight: '14px', flexShrink: 0, background: '#f0f0f0' },
  thumbPlaceholder: { width: '72px', height: '72px', borderRadius: '12px',
    marginRight: '14px', flexShrink: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '28px', background: '#f7f7f7' },
  productInfo: { flex: 1 },
  productName: { fontWeight: '700', fontSize: '15px', margin: '0 0 4px' },
  productMeta: { color: '#888', fontSize: '13px', margin: '0 0 8px' },
  productStats: { display: 'flex', gap: '8px' },
  pill: { background: '#f0f0f0', padding: '3px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600' },
  productActions: { display: 'flex', gap: '8px', marginLeft: '12px' },
  editBtn: { padding: '7px 16px', background: '#f0f0f0', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  toggleBtn: { padding: '7px 16px', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  editForm: { padding: '16px' },
  editGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px', marginBottom: '16px' },
  fullWidth: { gridColumn: '1 / -1' },
  label: { fontSize: '12px', fontWeight: '600', color: '#888',
    display: 'block', marginBottom: '4px' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #ddd',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', background: 'white' },
  editActions: { display: 'flex', gap: '10px' },
  saveBtn: { padding: '10px 24px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
  cancelBtn: { padding: '10px 24px', background: 'white', color: '#555',
    border: '1.5px solid #ddd', borderRadius: '8px', cursor: 'pointer' },
  searchInput: { width: '100%', padding: '10px 14px', border: '1.5px solid #ddd',
    borderRadius: '10px', fontSize: '14px', marginBottom: '14px',
    boxSizing: 'border-box', outline: 'none' }
}
