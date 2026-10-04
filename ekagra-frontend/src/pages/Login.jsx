import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/roles';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      login({ access_token: data.access_token, role: data.role });
      navigate(homePathForRole(data.role), { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid email or password. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10"
         style={{ background: 'var(--color-bg)' }}>

      {/* Brand mark */}
      <div className="flex items-center gap-2 mb-8 fade-up">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #BA6838, #9E5326)' }}>
          <span className="text-white font-bold text-lg">E</span>
        </div>
        <span className="text-2xl font-bold" style={{ color: '#BA6838' }}>Ekagra</span>
      </div>

      {/* Card */}
      <div className="card w-full max-w-md fade-up" style={{ animationDelay: '0.05s' }}>
        <h2 className="text-xl font-bold mb-1" style={{ color: '#2D3436' }}>Welcome back</h2>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Sign in to continue your journey</p>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
               style={{ background: '#FFF0F0', color: '#C0392B', border: '1.5px solid #FADADD' }}
               role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-sm font-medium" style={{ color: '#2D3436' }}>
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                   style={{ color: '#B0AABF' }} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                className="input-field"
                style={{ paddingLeft: '3rem' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-medium" style={{ color: '#2D3436' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                   style={{ color: '#B0AABF' }} />
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="input-field pr-11"
                style={{ paddingLeft: '3rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ color: '#B0AABF' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: '#6B7280' }}>
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold"
                style={{ color: '#BA6838', textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
