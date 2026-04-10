import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const SPECS = ['electrical', 'plumbing', 'painting']
const SPEC_LABEL = { electrical: '⚡ Electrician', plumbing: '🔧 Plumber', painting: '🎨 Painter' }
const EMPTY = { name: '', phone: '', specialization: 'electrical' }

export default function Technicians() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTechnicians() }, [])

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .order('created_at', { ascending: false })
    setTechnicians(data || [])
    setLoading(false)
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setEdit = (key) => (e) => setEditForm(f => ({ ...f, [key]: e.target.value }))

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert('Name and phone are required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('technicians').insert({ ...form })
    setSaving(false)
    if (error) { alert(error.message); return }
    setForm(EMPTY)
    fetchTechnicians()
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditForm({ name: t.name, phone: t.phone, specialization: t.specialization })
  }

  const saveEdit = async (id) => {
    await supabase.from('technicians').update(editForm).eq('id', id)
    setEditingId(null)
    fetchTechnicians()
  }

  const toggleActive = async (id, current) => {
    await supabase.from('technicians').update({ is_active: !current }).eq('id', id)
    setTechnicians(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t))
  }

  return (
    <div className="admin-products-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Technicians</h1>
          <p className="admin-page-sub">{technicians.filter(t => t.is_active).length} active · {technicians.length} total</p>
        </div>
      </div>

      {/* Add form */}
      <div className="admin-form-card" style={{ marginBottom: 24 }}>
        <h3 className="admin-form-section-title">Add Technician</h3>
        <div className="admin-form-row">
          <div className="field">
            <span>Name</span>
            <input className="input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={set('name')} />
          </div>
          <div className="field">
            <span>Phone</span>
            <input className="input" placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} maxLength={10} />
          </div>
          <div className="field">
            <span>Specialization</span>
            <select className="input" value={form.specialization} onChange={set('specialization')}>
              {SPECS.map(s => <option key={s} value={s}>{SPEC_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
            <button className="button button--primary button--sm" onClick={handleAdd} disabled={saving}>
              {saving ? 'Adding...' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-state"><p>Loading...</p></div>
      ) : technicians.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__icon">👷</p>
          <h3 className="empty-state__title">No technicians yet</h3>
          <p>Add your first technician above.</p>
        </div>
      ) : (
        <div className="admin-product-list">
          {technicians.map(t => (
            <div key={t.id} className={`admin-product-card${!t.is_active ? ' admin-product-card--inactive' : ''}`}>
              {editingId === t.id ? (
                <div style={{ padding: 16 }}>
                  <div className="admin-form-row">
                    <div className="field">
                      <span>Name</span>
                      <input className="input" value={editForm.name} onChange={setEdit('name')} />
                    </div>
                    <div className="field">
                      <span>Phone</span>
                      <input className="input" value={editForm.phone} onChange={setEdit('phone')} />
                    </div>
                    <div className="field">
                      <span>Specialization</span>
                      <select className="input" value={editForm.specialization} onChange={setEdit('specialization')}>
                        {SPECS.map(s => <option key={s} value={s}>{SPEC_LABEL[s]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="admin-edit-actions">
                    <button className="button button--primary button--sm" onClick={() => saveEdit(t.id)}>Save</button>
                    <button className="button button--ghost button--sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="admin-product-row">
                  <div style={{ fontSize: 32 }}>{SPEC_LABEL[t.specialization]?.split(' ')[0]}</div>
                  <div className="admin-product-info">
                    <p className="admin-product-name">{t.name}</p>
                    <p className="admin-product-meta">
                      {SPEC_LABEL[t.specialization]} · 📞 {t.phone}
                    </p>
                    <div className="admin-product-badges">
                      <span className={`admin-badge ${t.is_active ? 'admin-badge--green' : 'admin-badge--red'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="admin-product-actions">
                    <button className="admin-action-btn" onClick={() => startEdit(t)}>Edit</button>
                    <button
                      className={`admin-action-btn ${t.is_active ? 'admin-action-btn--warn' : 'admin-action-btn--green'}`}
                      onClick={() => toggleActive(t.id, t.is_active)}
                    >
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
