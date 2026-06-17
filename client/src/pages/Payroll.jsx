import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Payroll() {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => api.get(`/payroll?month=${month}&year=${year}`).then(r => setRows(r.data));
  useEffect(() => { load(); }, [month, year]);

  const generate = async () => {
    if (!window.confirm(`Generate payroll for ${String(month).padStart(2,'0')}/${year}?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post('/payroll/generate', { month, year });
      setMsg(`Generated ${data.generated} payslips`);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const download = async (id) => {
    const r = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalNet = rows.reduce((s, r) => s + (r.net_pay || 0), 0);

  return (
    <>
      <div className="page-hero hero-payroll">
        <div><h2>Payroll Management</h2><p>Generate monthly payroll and download PDF payslips for the team.</p></div>
        <button className="btn btn-primary" onClick={generate} disabled={busy}>{busy ? 'Generating...' : 'Generate Payroll'}</button>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      <div className="toolbar">
        <label>Month:</label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>)}
        </select>
        <label>Year:</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>Total payout: <strong style={{ color: 'var(--navy)' }}>₹{totalNet.toLocaleString('en-IN')}</strong></span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Designation</th><th>Basic</th><th>HRA</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="empty">No payroll generated for this period</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td><strong>{r.employee_name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{r.employee_code}</div></td>
                <td>{r.designation || '-'}</td>
                <td>₹{r.basic.toLocaleString('en-IN')}</td>
                <td>₹{r.hra.toLocaleString('en-IN')}</td>
                <td>₹{r.allowances.toLocaleString('en-IN')}</td>
                <td>₹{r.deductions.toLocaleString('en-IN')}</td>
                <td><strong style={{ color: 'var(--navy)' }}>₹{r.net_pay.toLocaleString('en-IN')}</strong></td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => download(r.id)}>Download PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
