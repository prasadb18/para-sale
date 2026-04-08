import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductImageField from '../../components/admin/ProductImageField'
import { supabase } from '../../lib/supabase'

const UNITS = ['piece', 'metre', 'kg', 'litre', 'box', 'roll', 'bag']

const CSV_HEADERS = ['name', 'description', 'brand', 'spec', 'price', 'mrp', 'stock', 'unit', 'category_name', 'image_url', 'is_active']

function downloadTemplate() {
  const sample = [
    CSV_HEADERS.join(','),
    '"Example Drill Bit Set","10-piece HSS drill bit set","Bosch","10-piece HSS","499","599","50","piece","Tools","","true"',
    '"PVC Pipe 1 inch","1 metre rigid PVC pipe","Finolex","1 inch dia","35","40","200","metre","Plumbing","","true"'
  ].join('\n')
  const blob = new Blob([sample], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '1shopstore_products_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const values = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { values.push(current.trim()); current = '' }
      else { current += ch }
    }
    values.push(current.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  }).filter(row => row.name)
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [tab, setTab] = useState('products') // 'products' | 'csv'
  const [csvRows, setCsvRows] = useState([])
  const [csvError, setCsvError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null) // { done, total, errors }
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()
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
      spec: product.spec || '',
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
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  const deleteProduct = async (id) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const handleFileChange = (e) => {
    setCsvError('')
    setCsvRows([])
    setImportResult(null)
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result)
        if (!rows.length) { setCsvError('No valid rows found in CSV.'); return }
        setCsvRows(rows)
      } catch {
        setCsvError('Failed to parse CSV. Make sure it matches the template.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)
    setImportProgress(null)

    const errors = []
    const BATCH_SIZE = 50

    // Separate valid and invalid rows upfront
    const valid = []
    const invalid = []
    for (const row of csvRows) {
      if (!row.name || !row.price || !row.stock) {
        invalid.push(`"${row.name || 'unnamed'}": missing name, price or stock`)
      } else {
        const cat = categories.find(c =>
          c.name.toLowerCase() === (row.category_name || '').toLowerCase()
        )
        valid.push({
          name: row.name,
          description: row.description || '',
          brand: row.brand || '',
          spec: row.spec || '',
          price: parseFloat(row.price) || 0,
          mrp: row.mrp ? parseFloat(row.mrp) : null,
          stock: parseInt(row.stock) || 0,
          unit: row.unit || 'piece',
          category_id: cat?.id || null,
          image_url: row.image_url || '',
          is_active: row.is_active !== 'false'
        })
      }
    }

    errors.push(...invalid)
    let success = 0
    let failed = invalid.length
    setImportProgress({ done: 0, total: valid.length, errors: [] })

    // Insert in batches of 50
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('products').insert(batch)
      if (error) {
        failed += batch.length
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      } else {
        success += batch.length
      }
      setImportProgress({ done: Math.min(i + BATCH_SIZE, valid.length), total: valid.length, errors })
    }

    setImportResult({ success, failed, errors })
    setImporting(false)
    if (success > 0) fetchProducts()
    if (fileRef.current) fileRef.current.value = ''
    setCsvRows([])
  }

  const visible = products.filter(p => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)
  })

  return (
    <div className="admin-products-page">
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-sub">{products.length} total · {products.filter(p => p.is_active).length} active</p>
        </div>
        <div className="admin-header-actions">
          <button
            className={`admin-tab-btn${tab === 'products' ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setTab('products')}
          >
            All Products
          </button>
          <button
            className={`admin-tab-btn${tab === 'csv' ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setTab('csv')}
          >
            Bulk Upload CSV
          </button>
          <button className="button button--primary button--sm" onClick={() => navigate('/admin/products/new')}>
            + Add Product
          </button>
        </div>
      </div>

      {/* ── Products Tab ── */}
      {tab === 'products' && (
        <>
          <div className="admin-search-bar">
            <input
              className="input"
              placeholder="Search by name or brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading-state"><p>Loading products...</p></div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__icon">📦</p>
              <h3 className="empty-state__title">No products found</h3>
              <p>Try a different search or add your first product.</p>
            </div>
          ) : (
            <div className="admin-product-list">
              {visible.map(product => (
                <div
                  key={product.id}
                  className={`admin-product-card${!product.is_active ? ' admin-product-card--inactive' : ''}`}
                >
                  {editingId === product.id ? (
                    <div className="admin-edit-form">
                      <div className="admin-edit-grid">
                        <div className="admin-edit-full">
                          <ProductImageField
                            value={form.image_url}
                            onChange={imageUrl => setForm({ ...form, image_url: imageUrl })}
                            productName={form.name}
                          />
                        </div>
                        {[
                          { label: 'Name', key: 'name', type: 'text' },
                          { label: 'Brand', key: 'brand', type: 'text' },
                          { label: 'Spec', key: 'spec', type: 'text' },
                          { label: 'Price (₹)', key: 'price', type: 'number' },
                          { label: 'MRP (₹)', key: 'mrp', type: 'number' },
                          { label: 'Stock', key: 'stock', type: 'number' },
                        ].map(({ label, key, type }) => (
                          <div key={key} className="field">
                            <span>{label}</span>
                            <input className="input" type={type} value={form[key]}
                              onChange={e => setForm({ ...form, [key]: e.target.value })} />
                          </div>
                        ))}
                        <div className="field">
                          <span>Unit</span>
                          <select className="input" value={form.unit}
                            onChange={e => setForm({ ...form, unit: e.target.value })}>
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <span>Category</span>
                          <select className="input" value={form.category_id}
                            onChange={e => setForm({ ...form, category_id: e.target.value })}>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="admin-edit-actions">
                        <button className="button button--primary button--sm" onClick={() => saveEdit(product.id)}>
                          Save Changes
                        </button>
                        <button className="button button--ghost button--sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-product-row">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="admin-product-thumb" />
                      ) : (
                        <div className="admin-product-thumb admin-product-thumb--empty">📦</div>
                      )}

                      <div className="admin-product-info">
                        <p className="admin-product-name">{product.name}</p>
                        <p className="admin-product-meta">
                          {product.categories?.name || '—'} · {product.brand || 'No brand'} · {product.unit}
                        </p>
                        <div className="admin-product-badges">
                          <span className="admin-badge">₹{product.price}</span>
                          {product.mrp && (
                            <span className="admin-badge admin-badge--muted">MRP ₹{product.mrp}</span>
                          )}
                          <span className={`admin-badge ${product.stock > 5 ? 'admin-badge--green' : 'admin-badge--red'}`}>
                            {product.stock} {product.unit}s
                          </span>
                          {!product.is_active && (
                            <span className="admin-badge admin-badge--muted">Hidden</span>
                          )}
                        </div>
                      </div>

                      <div className="admin-product-actions">
                        <button className="admin-action-btn" onClick={() => startEdit(product)}>
                          Edit
                        </button>
                        <button
                          className={`admin-action-btn ${product.is_active ? 'admin-action-btn--warn' : 'admin-action-btn--green'}`}
                          onClick={() => toggleActive(product.id, product.is_active)}
                        >
                          {product.is_active ? 'Hide' : 'Show'}
                        </button>
                        {deletingId === product.id ? (
                          <>
                            <button className="admin-action-btn admin-action-btn--danger"
                              onClick={() => deleteProduct(product.id)}>
                              Confirm
                            </button>
                            <button className="admin-action-btn" onClick={() => setDeletingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="admin-action-btn admin-action-btn--ghost"
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
          )}
        </>
      )}

      {/* ── CSV Bulk Upload Tab ── */}
      {tab === 'csv' && (
        <div className="csv-upload-panel">
          <div className="csv-upload-info">
            <div className="csv-info-card">
              <h3>How bulk upload works</h3>
              <ol>
                <li>Download the CSV template below</li>
                <li>Fill in your products — one row per product</li>
                <li>Use exact <strong>category names</strong> as they exist in your store</li>
                <li>Upload the filled CSV and preview the rows</li>
                <li>Click <strong>Import All</strong> to add them in one go</li>
              </ol>
              <div className="csv-columns">
                <p><strong>CSV columns:</strong></p>
                <div className="csv-column-tags">
                  {CSV_HEADERS.map(h => (
                    <span key={h} className="csv-column-tag">{h}</span>
                  ))}
                </div>
              </div>
              <button className="button button--secondary button--sm" onClick={downloadTemplate}>
                ↓ Download Template CSV
              </button>
            </div>

            <div className="csv-category-hint">
              <p><strong>Your categories</strong> (use exact names in CSV):</p>
              <div className="csv-column-tags">
                {categories.map(c => (
                  <span key={c.id} className="csv-column-tag csv-column-tag--cat">{c.name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="csv-drop-zone">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              id="csv-file-input"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor="csv-file-input" className="csv-drop-label">
              <span className="csv-drop-icon">📄</span>
              <strong>Click to select CSV file</strong>
              <span>or drag and drop your filled template</span>
            </label>
          </div>

          {csvError && (
            <div className="error-banner">{csvError}</div>
          )}

          {importResult && (
            <div className={`import-result ${importResult.failed > 0 ? 'import-result--warn' : 'import-result--ok'}`}>
              <strong>Import complete:</strong> {importResult.success} added successfully
              {importResult.failed > 0 && `, ${importResult.failed} failed`}
              {importResult.errors.length > 0 && (
                <ul className="import-errors">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {csvRows.length > 0 && (
            <>
              <div className="csv-preview-header">
                <p><strong>{csvRows.length} rows</strong> ready to import</p>
                <button
                  className="button button--primary button--sm"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : `Import ${csvRows.length} Products`}
                </button>
              </div>

              {importing && importProgress && (
                <div className="import-progress">
                  <div className="import-progress__header">
                    <span>Importing products…</span>
                    <span><strong>{importProgress.done}</strong> / {importProgress.total}</span>
                  </div>
                  <div className="import-progress__bar-track">
                    <div
                      className="import-progress__bar-fill"
                      style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="import-progress__pct">
                    {Math.round((importProgress.done / importProgress.total) * 100)}% complete
                    {importProgress.errors.length > 0 && ` · ${importProgress.errors.length} error(s)`}
                  </p>
                </div>
              )}

              <div className="csv-preview-table-wrap">
                <table className="csv-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>MRP</th>
                      <th>Stock</th>
                      <th>Unit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => {
                      const catMatch = categories.find(c =>
                        c.name.toLowerCase() === (row.category_name || '').toLowerCase()
                      )
                      const hasError = !row.name || !row.price || !row.stock
                      return (
                        <tr key={i} className={hasError ? 'csv-row--error' : ''}>
                          <td>{i + 1}</td>
                          <td>{row.name || <span className="csv-missing">missing</span>}</td>
                          <td>{row.brand || '—'}</td>
                          <td>
                            {catMatch
                              ? <span className="csv-cat-ok">{row.category_name}</span>
                              : <span className="csv-cat-miss">{row.category_name || '—'} ⚠️</span>
                            }
                          </td>
                          <td>{row.price ? `₹${row.price}` : <span className="csv-missing">missing</span>}</td>
                          <td>{row.mrp ? `₹${row.mrp}` : '—'}</td>
                          <td>{row.stock || <span className="csv-missing">missing</span>}</td>
                          <td>{row.unit || 'piece'}</td>
                          <td>{row.is_active === 'false' ? '🔴 Hidden' : '🟢 Active'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
