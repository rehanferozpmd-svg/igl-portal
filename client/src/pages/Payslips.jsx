import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Payslips() {
  const [rows, setRows] = useState([]);

  useEffect(() => { api.get('/payroll').then(r => setRows(r.data)); }, []);

  const download = async (id) => {
    const r = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const month = (m) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' });

  return (
    <>
      <div className="page-hero hero-payslips">
        <div><h2>My Payslips</h2><p>Download your monthly salary slips as PDF.</p></div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Period</th><th>Basic</th><th>HRA</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Generated</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="empty">No payslips available yet</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td><strong>{month(r.month)} {r.year}</strong></td>
                <td>₹{r.basic.toLocaleString('en-IN')}</td>
                <td>₹{r.hra.toLocaleString('en-IN')}</td>
                <td>₹{r.allowances.toLocaleString('en-IN')}</td>
                <td>₹{r.deductions.toLocaleString('en-IN')}</td>
                <td><strong style={{ color: 'var(--navy)' }}>₹{r.net_pay.toLocaleString('en-IN')}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{new Date(r.generated_at).toLocaleDateString()}</td>
                <td><button className="btn btn-sm btn-primary" onClick={() => download(r.id)}>Download</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
