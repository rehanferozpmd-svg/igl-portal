import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.employee?.id) api.get(`/employees/${user.employee.id}`).then(r => setEmp(r.data));
  }, []);

  const changePass = async (e) => {
    e.preventDefault();
    setPwMsg({});
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg({ type: 'success', text: 'Password updated successfully' });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  if (!emp) return <div className="loader" />;

  return (
    <>
      <div className="profile-header">
        <div className="avatar avatar-lg">{emp.first_name[0]}{emp.last_name[0]}</div>
        <div style={{ flex: 1 }}>
          <h2>{emp.first_name} {emp.last_name}</h2>
          <div className="designation">{emp.designation || 'Team Member'} · {emp.department_name || 'No department'}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{emp.email} · Code: {emp.employee_code}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>My Information</h3></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item"><label>Phone</label><div className="value">{emp.phone || '-'}</div></div>
              <div className="info-item"><label>Date of Birth</label><div className="value">{emp.dob || '-'}</div></div>
              <div className="info-item"><label>Joining Date</label><div className="value">{emp.joining_date}</div></div>
              <div className="info-item"><label>State</label><div className="value">{emp.state || '-'}</div></div>
              <div className="info-item"><label>Manager</label><div className="value">{emp.manager_name || '-'}</div></div>
              <div className="info-item"><label>Team</label><div className="value">{emp.team_name || '-'}</div></div>
              <div className="info-item" style={{ gridColumn: '1 / -1' }}><label>Address</label><div className="value">{emp.address || '-'}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Change Password</h3></div>
          <div className="card-body">
            {pwMsg.type === 'error' && <div className="error-msg">{pwMsg.text}</div>}
            {pwMsg.type === 'success' && <div className="success-msg">{pwMsg.text}</div>}
            <form onSubmit={changePass}>
              <div className="form-group"><label>Current Password</label><input type="password" className="form-control" required value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
              <div className="form-group"><label>New Password</label><input type="password" className="form-control" required value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
              <div className="form-group"><label>Confirm New Password</label><input type="password" className="form-control" required value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
              <button className="btn btn-primary" type="submit">Update Password</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
