import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const toSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '' })
  const [newForm, setNewForm] = useState({ name: '', slug: '' })
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug, created_at')
      .order('name', { ascending: true })
    setCategories(data || [])
    setLoading(false)
  }

  const addCategory = async () => {
    setError('')
    if (!newForm.name.trim()) return setError('Name is required')
    const slug = newForm.slug.trim() || toSlug(newForm.name)
    const { error: err } = await supabase
      .from('categories')
      .insert({ name: newForm.name.trim(), slug })
    if (err) return setError(err.message)
    setNewForm({ name: '', slug: '' })
    setAdding(false)
    fetchCategories()
  }

  const saveEdit = async (id) => {
    setError('')
    if (!editForm.name.trim()) return setError('Name is required')
    const slug = editForm.slug.trim() || toSlug(editForm.name)
    const { error: err } = await supabase
      .from('categories')
      .update({ name: editForm.name.trim(), slug })
      .eq('id', id)
    if (err) return setError(err.message)
    setEditingId(null)
    fetchCategories()
  }

  const deleteCategory = async (id) => {
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  if (loading) return <p style={{ padding: '40px', textAlign: 'center' }}>Loading...</p>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Categories ({categories.length})</h2>
        <button style={styles.addBtn} onClick={() => { setAdding(true); setError('') }}>
          + Add Category
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {adding && (
        <div style={styles.card}>
          <p style={styles.formTitle}>New Category</p>
          <div style={styles.formRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Name</label>
              <input style={styles.input} placeholder="e.g. Pipes & Fittings"
                value={newForm.name}
                onChange={e => setNewForm({ name: e.target.value, slug: toSlug(e.target.value) })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Slug (auto-filled)</label>
              <input style={styles.input} placeholder="e.g. pipes"
                value={newForm.slug}
                onChange={e => setNewForm({ ...newForm, slug: e.target.value })} />
            </div>
          </div>
          <div style={styles.actions}>
            <button style={styles.saveBtn} onClick={addCategory}>Save</button>
            <button style={styles.cancelBtn} onClick={() => { setAdding(false); setError('') }}>Cancel</button>
          </div>
        </div>
      )}

      {categories.map(cat => (
        <div key={cat.id} style={styles.card}>
          {editingId === cat.id ? (
            <>
              <div style={styles.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Name</label>
                  <input style={styles.input} value={editForm.name}
                    onChange={e => setEditForm({ name: e.target.value, slug: toSlug(e.target.value) })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Slug</label>
                  <input style={styles.input} value={editForm.slug}
                    onChange={e => setEditForm({ ...editForm, slug: e.target.value })} />
                </div>
              </div>
              <div style={styles.actions}>
                <button style={styles.saveBtn} onClick={() => saveEdit(cat.id)}>Save</button>
                <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={styles.row}>
              <div>
                <p style={styles.catName}>{cat.name}</p>
                <p style={styles.catSlug}>/{cat.slug}</p>
              </div>
              <div style={styles.rowActions}>
                <button style={styles.editBtn} onClick={() => {
                  setEditingId(cat.id)
                  setEditForm({ name: cat.name, slug: cat.slug })
                  setError('')
                }}>Edit</button>
                {deletingId === cat.id ? (
                  <>
                    <button style={{ ...styles.editBtn, background: '#e91e63', color: 'white' }}
                      onClick={() => deleteCategory(cat.id)}>Confirm Delete</button>
                    <button style={styles.cancelBtn} onClick={() => setDeletingId(null)}>Cancel</button>
                  </>
                ) : (
                  <button style={{ ...styles.editBtn, color: '#e91e63' }}
                    onClick={() => setDeletingId(cat.id)}>Delete</button>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  heading: { fontSize: '20px', margin: 0 },
  addBtn: { padding: '10px 20px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
  error: { color: '#e91e63', background: '#fce4ec', padding: '10px 14px',
    borderRadius: '8px', fontSize: '14px', marginBottom: '14px' },
  card: { border: '1px solid #eee', borderRadius: '14px', padding: '16px',
    marginBottom: '10px', background: 'white' },
  formTitle: { fontWeight: '700', margin: '0 0 12px', fontSize: '15px' },
  formRow: { display: 'flex', gap: '12px', marginBottom: '12px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#888', display: 'block', marginBottom: '4px' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #ddd',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '10px' },
  saveBtn: { padding: '9px 22px', background: '#1a1a2e', color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
  cancelBtn: { padding: '9px 22px', background: 'white', color: '#555',
    border: '1.5px solid #ddd', borderRadius: '8px', cursor: 'pointer' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontWeight: '700', fontSize: '15px', margin: '0 0 3px' },
  catSlug: { color: '#aaa', fontSize: '13px', margin: 0 },
  rowActions: { display: 'flex', gap: '8px' },
  editBtn: { padding: '7px 16px', background: '#f0f0f0', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }
}
