import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import './Auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', role: 'passenger',
  });
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await register(form);
      navigate('/');
    } catch {}
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-up">
        <div className="auth-logo">
          <span className="logo-icon">🚗</span>
          <h1 className="auth-title">RideHail</h1>
        </div>
        <p className="auth-subtitle">Create your account</p>

        {error && <div className="auth-error" onClick={clearError}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="role-selector">
            {['passenger', 'driver'].map((r) => (
              <button
                key={r}
                type="button"
                className={`role-btn ${form.role === r ? 'active' : ''}`}
                onClick={() => set('role', r)}
              >
                <span className="role-icon">{r === 'passenger' ? '🧑' : '🚙'}</span>
                <span className="role-name">{r.charAt(0).toUpperCase() + r.slice(1)}</span>
              </button>
            ))}
          </div>

          {['name', 'email', 'phone'].map((field) => (
            <div className="field" key={field}>
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                type={field === 'email' ? 'email' : 'text'}
                className="input"
                value={form[field]}
                onChange={(e) => set(field, e.target.value)}
                placeholder={field === 'email' ? 'your@email.com' : field === 'phone' ? '+1 234 567 8900' : 'Full name'}
                required
              />
            </div>
          ))}

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Min. 8 characters with a number"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
