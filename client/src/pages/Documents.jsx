import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Documents() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState([]);
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  const load = async () => {
    const [docs, t] = await Promise.all([
      api.get('/documents'),
      api.get('/documents/types'),
    ]);
    setRows(docs.data);
    setTypes(t.data);
    if (!type) setType(t.data[0]?.name || '');
    if (user.role !== 'employee') {
      const s = await api.get('/documents/status');
      setStatus(s.data);
    }
  };
  useEffect(() => { load(); }, []);

  const myUploaded = new Set(rows.filter(r => !r.employee_name || r.employee_code === user.employee?.employee_code).map(r => r.type));
  const myProgress = types.filter(t => t.mandatory && myUploaded.has(t.name)).length;
  const myTotalMandatory = types.filter(t => t.mandatory).length;
  const myPct = myTotalMandatory ? (myProgress / myTotalMandatory) * 100 : 0;

  const upload = async (e) => {
    e.preventDefault();
    setErr('');
    const file = fileRef.current.files[0];
    if (!file) return;
    if (!type) { setErr('Pick a document type first'); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', type);
    fd.append('type', type);
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      load();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const download = async (d) => {
    const r = await api.get(`/documents/${d.id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = d.name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    await api.delete(`/documents/${id}`);
    load();
  };

  const docIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" /></svg>
  );
  const tickIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const warnIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
  );

  return (
    <>
      <div className="page-hero hero-documents">
        <div>
          <h2>Documents</h2>
          <p>Upload your HR documents. Aadhar Card, PAN Card, Offer Letter and Provisional Certificate are mandatory.</p>
        </div>
        {user.role === 'employee' && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <svg className="progress-ring" viewBox="0 0 56 56">
              <circle className="progress-ring-bg" cx="28" cy="28" r="22" />
              <circle className="progress-ring-fg" cx="28" cy="28" r="22"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={(2 * Math.PI * 22) * (1 - myPct / 100)} />
            </svg>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{myProgress} / {myTotalMandatory}</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Mandatory uploaded</div>
            </div>
          </div>
        )}
      </div>

      {/* Checklist (employee view) */}
      {user.role === 'employee' && types.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Your Document Checklist</h3>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{myProgress === myTotalMandatory ? 'All mandatory documents uploaded' : `${myTotalMandatory - myProgress} mandatory document(s) missing`}</span>
          </div>
          <div className="card-body">
            <div className="doc-checklist">
              {types.map(t => {
                const has = myUploaded.has(t.name);
                const cls = `doc-tile ${has ? 'done' : 'missing'} ${t.mandatory ? '' : 'optional'}`;
                return (
                  <div key={t.code} className={cls}>
                    <div className="doc-tile-icon">{has ? tickIcon : (t.mandatory ? warnIcon : docIcon)}</div>
                    <div className="doc-tile-content">
                      <div className="doc-tile-title">
                        {t.name}
                        {t.mandatory && <span className="badge badge-danger" style={{ padding: '1px 7px', fontSize: 10 }}>Mandatory</span>}
                        {!t.mandatory && <span className="badge badge-default" style={{ padding: '1px 7px', fontSize: 10 }}>Optional</span>}
                      </div>
                      <div className="doc-tile-status">
                        {has ? 'Uploaded' : (t.mandatory ? 'Pending upload' : 'Not uploaded')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Upload Document</h3></div>
        <div className="card-body">
          {err && <div className="error-msg">{err}</div>}
          <form onSubmit={upload}>
            <div className="form-grid">
              <div className="form-group full">
                <label>Document Type *</label>
                <select className="form-control" value={type} onChange={(e) => setType(e.target.value)} required>
                  {types.map(t => (
                    <option key={t.code} value={t.name}>
                      {t.name} {t.mandatory ? '(Mandatory)' : '(Optional)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>File (max 10MB) *</label>
                <input type="file" ref={fileRef} required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Uploading...' : 'Upload'}</button>
          </form>
        </div>
      </div>

      {/* HR / Manager — completion status across team */}
      {user.role !== 'employee' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Team Document Compliance</h3>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
              {status.filter(s => s.complete).length} / {status.length} employees compliant
            </span>
          </div>
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Progress</th><th>Status</th><th>Missing Documents</th></tr>
            </thead>
            <tbody>
              {status.length === 0 && <tr><td colSpan="4" className="empty">No employees</td></tr>}
              {status.map(s => {
                const pct = (s.uploaded / s.total_required) * 100;
                return (
                  <tr key={s.employee_id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{s.employee_code}</div>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: s.complete ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>{s.uploaded} / {s.total_required}</span>
                      </div>
                    </td>
                    <td>
                      {s.complete
                        ? <span className="badge badge-success">Compliant</span>
                        : <span className="badge badge-warning">{s.missing.length} missing</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {s.missing.length === 0 ? '—' : s.missing.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* All documents list */}
      <div className="card">
        <div className="card-header"><h3>{user.role === 'employee' ? 'My Uploaded Documents' : 'All Uploaded Documents'}</h3></div>
        <table className="table">
          <thead>
            <tr>{user.role !== 'employee' && <th>Employee</th>}<th>Type</th><th>File Name</th><th>Size</th><th>Uploaded</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={user.role !== 'employee' ? 6 : 5} className="empty">No documents</td></tr>}
            {rows.map(d => (
              <tr key={d.id}>
                {user.role !== 'employee' && <td>{d.employee_name || '-'}</td>}
                <td>
                  <span className="badge badge-info">{d.type || 'Other'}</span>
                </td>
                <td><strong>{d.name}</strong></td>
                <td>{d.size ? `${(d.size / 1024).toFixed(1)} KB` : '-'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => download(d)} style={{ marginRight: 4 }}>Download</button>
                  {user.role === 'admin' && <button className="btn btn-sm btn-danger" onClick={() => del(d.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
