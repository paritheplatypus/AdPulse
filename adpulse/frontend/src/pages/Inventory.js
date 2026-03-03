import React, { useState, useEffect } from 'react';
import { getAds, createAd, updateAd, deleteAd } from '../services/api';

const CATEGORIES = ['technology', 'food_beverage', 'automotive', 'entertainment', 'finance', 'health_wellness', 'retail'];

const CATEGORY_BADGE = {
  technology: 'badge-blue', food_beverage: 'badge-green', automotive: 'badge-amber',
  entertainment: 'badge-purple', finance: 'badge-gray', health_wellness: 'badge-green', retail: 'badge-amber',
};

const EMPTY_FORM = { title: '', advertiser: '', category: 'technology', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 };

export default function Inventory() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await getAds();
      setAds(data.ads);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.advertiser) { setError('Title and advertiser are required'); return; }
    setSaving(true);
    setError('');
    try {
      await createAd({
        ...form,
        duration_seconds: parseInt(form.duration_seconds),
        max_frequency_per_session: parseInt(form.max_frequency_per_session),
        weight: parseFloat(form.weight),
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setError(e.response?.data?.errors?.[0]?.msg || 'Failed to create ad. Make sure you are authenticated.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ad) => {
    await updateAd(ad.id, { active: !ad.active });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ad?')) return;
    await deleteAd(id);
    load();
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Ad Inventory</div>
          <div className="page-subtitle">{ads.length} ads · {ads.filter(a => a.active).length} active</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ New Ad'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Create New Ad</span>
          </div>
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--red)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              { key: 'title', label: 'Ad Title', type: 'text', placeholder: 'e.g. Drive the Future' },
              { key: 'advertiser', label: 'Advertiser', type: 'text', placeholder: 'e.g. Toyota' },
              { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number', placeholder: '30' },
              { key: 'max_frequency_per_session', label: 'Max Frequency / Session', type: 'number', placeholder: '2' },
              { key: 'weight', label: 'Weight (priority)', type: 'number', placeholder: '1.0', step: '0.1' },
            ].map(({ key, label, type, placeholder, step }) => (
              <div key={key}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
                <input
                  className="input"
                  type={type}
                  placeholder={placeholder}
                  step={step}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>Category</div>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Create Ad'}
          </button>
        </div>
      )}

      {/* Ads table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Advertiser</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Max Freq</th>
                <th>Weight</th>
                <th>Impressions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ads.map(ad => (
                <tr key={ad.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ad.title}</td>
                  <td>{ad.advertiser}</td>
                  <td>
                    <span className={`badge ${CATEGORY_BADGE[ad.category] || 'badge-gray'}`}>
                      {ad.category?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{ad.duration_seconds}s</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{ad.max_frequency_per_session}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{parseFloat(ad.weight).toFixed(1)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    {parseInt(ad.total_impressions || 0).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${ad.active ? 'badge-green' : 'badge-red'}`}>
                      {ad.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleToggle(ad)}>
                        {ad.active ? 'Pause' : 'Resume'}
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(ad.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
