import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@igenielabs.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand-block">
          <div className="brand-logo" style={{ width: 52, height: 52, fontSize: 17 }}>IGL</div>
          <div className="auth-brand-text">
            <div className="auth-brand-name">IGL Portal</div>
            <div className="auth-brand-sub">Human Resource Management System</div>
          </div>
        </div>

        <div className="auth-card-clean">
          <div className="auth-card-head">
            <h2>Sign in</h2>
            <p>Use your work email to access the portal</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={submit}>
            <div className="form-group">
              <label>Work email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ marginBottom: 6 }}>Password</label>
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider"><span>Test credentials</span></div>

          <div className="auth-roles">
            <button type="button" className="auth-role" onClick={() => setDemo('admin@igenielabs.com', 'Admin@123')}>
              <span className="auth-role-tag tag-admin">HR</span>
              <span className="auth-role-name">Administrator</span>
              <code>admin@igenielabs.com</code>
            </button>
            <button type="button" className="auth-role" onClick={() => setDemo('manager@igenielabs.com', 'Manager@123')}>
              <span className="auth-role-tag tag-mgr">MGR</span>
              <span className="auth-role-name">Manager</span>
              <code>manager@igenielabs.com</code>
            </button>
            <button type="button" className="auth-role" onClick={() => setDemo('employee@igenielabs.com', 'Employee@123')}>
              <span className="auth-role-tag tag-emp">EMP</span>
              <span className="auth-role-name">Employee</span>
              <code>employee@igenielabs.com</code>
            </button>
          </div>
        </div>

        <div className="auth-foot">
          <span className="auth-lock">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            Secure connection
          </span>
          <span>© {new Date().getFullYear()} IGL Portal. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
