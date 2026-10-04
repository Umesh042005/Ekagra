import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/roles';

export default function Signup() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [confirmed,   setConfirmed]   = useState(false); // email confirmation pending

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConfirmed(false);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create the account
      // Public signup is students-only; mentor accounts are created by the admin
      await api.post('/auth/signup', { name, email, password });

      // Step 2: Try to auto-login (works only if email confirmation is disabled)
      try {
        const { data } = await api.post('/auth/login', { email, password });
        login({ access_token: data.access_token, role: data.role });
        navigate(homePathForRole(data.role), { replace: true });
      } catch (loginErr) {
        const loginMsg = loginErr?.response?.data?.detail ?? '';
        if (
          typeof loginMsg === 'string' &&
          loginMsg.toLowerCase().includes('email not confirmed')
        ) {
          // Supabase requires email confirmation — show friendly message
          setConfirmed(true);
        } else {
          throw loginErr; // surface other login errors normally
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail;
      setError(
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
          ? msg.map((m) => m.msg).join(', ')
          : 'Sign up failed. Please try again.'
      );
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
        <h2 className="text-xl font-bold mb-1" style={{ color: '#2D3436' }}>Create account</h2>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Start your mindfulness journey today</p>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
               style={{ background: '#FFF0F0', color: '#C0392B', border: '1.5px solid #FADADD' }}
               role="alert">
            {error}
          </div>
        )}

        {/* Email confirmation pending */}
        {confirmed && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
               style={{ background: '#F0FFF4', color: '#276749', border: '1.5px solid #C6F6D5' }}
               role="status">
            ✅ Account created! Please check your inbox and confirm your email, then{' '}
            <a href="/login" style={{ color: '#276749', fontWeight: 600, textDecoration: 'underline' }}>
              sign in
            </a>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="signup-name" className="text-sm font-medium" style={{ color: '#2D3436' }}>
              Full Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                   style={{ color: '#B0AABF' }} />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                className="input-field"
                style={{ paddingLeft: '3rem' }}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="text-sm font-medium" style={{ color: '#2D3436' }}>
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                   style={{ color: '#B0AABF' }} />
              <input
                id="signup-email"
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
            <label htmlFor="signup-password" className="text-sm font-medium" style={{ color: '#2D3436' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                   style={{ color: '#B0AABF' }} />
              <input
                id="signup-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                className="input-field pr-11"
                style={{ paddingLeft: '3rem' }}
                placeholder="Min 6 characters"
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
            id="signup-submit-btn"
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: '#7D6E65' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold"
                style={{ color: '#BA6838', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
