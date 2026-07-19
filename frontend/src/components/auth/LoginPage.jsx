import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import './Auth.css';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await login(form);
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
        <p className="auth-subtitle">Sign in to your account</p>

        {error && (
          <div className="auth-error" onClick={clearError}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Register</Link>
        </p>

        <div className="auth-demo">
          <p>Demo accounts:</p>
          <div className="demo-btns">
            <button className="btn btn-ghost" onClick={() =>
              setForm({ email: 'passenger@demo.com', password: 'Demo1234' })
            }>Passenger</button>
            <button className="btn btn-ghost" onClick={() =>
              setForm({ email: 'driver@demo.com', password: 'Demo1234' })
            }>Driver</button>
          </div>
        </div>
      </div>
    </div>
  );
}
