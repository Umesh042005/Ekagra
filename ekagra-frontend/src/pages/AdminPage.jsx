import { useState, useEffect, useCallback } from 'react';
import {
  Shield, UserPlus, Users, GraduationCap, Search, Eye, EyeOff, Copy, Check,
  Loader2, AlertCircle, X, Wand2, Repeat,
} from 'lucide-react';
import api from '../api/axios';
import Header from '../components/Header';
import { formatDate } from '../utils/dateUtils';

function generatePassword() {
  // Readable temporary password, e.g. "Calm-4821-Lotus"
  const words = ['Calm', 'Lotus', 'Focus', 'Breath', 'Peace', 'River', 'Sky', 'Bloom'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${pick()}-${digits}-${pick()}`;
}

function errorText(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ');
  return fallback;
}

function Initial({ name }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-[#FAF0E7] text-[#BA6838] flex items-center justify-center text-sm font-bold flex-shrink-0">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

/** Form to create a mentor; shows the credentials to share once created. */
function AddMentorCard({ onCreated, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [showPass, setShowPass] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { name, email, password }
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/admin/mentors', { name, email, password });
      setCreated({ name: data.name, email: data.email, password });
      onCreated();
    } catch (err) {
      setError(errorText(err, 'Could not create mentor.'));
    } finally {
      setSubmitting(false);
    }
  };

  const shareText = created
    ? `Welcome to Ekagra, ${created.name}!\nLogin: ${window.location.origin}/login\nEmail: ${created.email}\nPassword: ${created.password}`
    : '';

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-sm text-[#261B14] focus:outline-none focus:border-[#BA6838]';

  return (
    <div className="bg-white rounded-3xl border border-[#EFE4D8] p-4 sm:p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-[#261B14] flex items-center gap-2">
          <UserPlus size={16} className="text-[#BA6838]" />
          {created ? 'Mentor created' : 'Add a mentor'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[#857368] hover:text-[#261B14]">
          <X size={18} />
        </button>
      </div>

      {created ? (
        <div className="space-y-3">
          <p className="text-xs text-[#635147]">
            Send these login details to <strong>{created.name}</strong> (for example on WhatsApp).
            This password is shown only now.
          </p>
          <pre className="p-3 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] whitespace-pre-wrap break-all font-mono">
            {shareText}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyShareText}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-xl flex items-center justify-center gap-1.5"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy message'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setName('');
                setEmail('');
                setPassword(generatePassword());
              }}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-[#7A6960] bg-[#F6ECE2] hover:bg-[#EFE4D8] rounded-xl"
            >
              Add another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="mentor-name" className="text-xs font-semibold text-[#261B14]">Full name</label>
            <input id="mentor-name" value={name} onChange={(e) => setName(e.target.value)} required
                   placeholder="Priya Sharma" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="mentor-email" className="text-xs font-semibold text-[#261B14]">Email</label>
            <input id="mentor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                   placeholder="priya@example.com" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="mentor-password" className="text-xs font-semibold text-[#261B14]">Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="mentor-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#857368]"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                title="Generate a new password"
                className="px-3 bg-[#F6ECE2] hover:bg-[#EFE4D8] text-[#BA6838] rounded-xl flex items-center gap-1 text-xs font-semibold"
              >
                <Wand2 size={14} /> New
              </button>
            </div>
            <p className="text-[11px] text-[#857368]">At least 6 characters. You can type your own or use the suggested one.</p>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-1.5" role="alert">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {submitting ? 'Creating…' : 'Create mentor'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('mentors'); // 'mentors' | 'students'
  const [mentors, setMentors] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([api.get('/admin/mentors'), api.get('/admin/students')]);
      setMentors(m.data || []);
      setStudents(s.data || []);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Unable to load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleMentor = async (mentor) => {
    const action = mentor.is_active ? 'deactivate' : 'activate';
    if (action === 'deactivate') {
      const seriesWarning = mentor.running_series
        ? `\n\n⚠️ ${mentor.name} is in ${mentor.running_series} running series. Their future sessions in those series will be skipped — consider ending or recreating those series.`
        : '';
      if (!window.confirm(`Deactivate ${mentor.name}? They will not be able to log in. Nothing is deleted.${seriesWarning}`)) {
        return;
      }
    }
    setBusyId(mentor.id);
    setError('');
    try {
      const { data } = await api.post(`/admin/mentors/${mentor.id}/${action}`);
      setMentors((prev) => prev.map((m) => (m.id === mentor.id ? data : m)));
    } catch (err) {
      setError(errorText(err, `Could not ${action} mentor.`));
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const matches = (u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  const list = (tab === 'mentors' ? mentors : students).filter(matches);
  const activeMentors = mentors.filter((m) => m.is_active).length;

  return (
    <div className="min-h-dvh pb-16" style={{ background: '#F6ECE2' }}>
      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-xl sm:text-2xl text-[#261B14] tracking-tight flex items-center gap-2">
              <Shield size={22} className="text-[#BA6838]" />
              Admin Panel
            </h1>
            <p className="text-xs text-[#857368] mt-0.5">Create mentor accounts and see everyone on Ekagra.</p>
          </div>
          {!showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="py-2.5 px-3.5 bg-[#BA6838] hover:bg-[#A8582A] text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 flex-shrink-0"
            >
              <UserPlus size={15} /> Add Mentor
            </button>
          )}
        </div>

        {showAdd && <AddMentorCard onCreated={fetchAll} onClose={() => setShowAdd(false)} />}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-[#EFE4D8] p-3.5">
            <p className="text-[11px] font-semibold text-[#857368] uppercase tracking-wide">Mentors</p>
            <p className="text-2xl font-bold text-[#261B14] mt-1">{loading ? '–' : activeMentors}</p>
            <p className="text-[11px] text-[#857368]">
              active{mentors.length > activeMentors ? ` · ${mentors.length - activeMentors} deactivated` : ''}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#EFE4D8] p-3.5">
            <p className="text-[11px] font-semibold text-[#857368] uppercase tracking-wide">Students</p>
            <p className="text-2xl font-bold text-[#261B14] mt-1">{loading ? '–' : students.length}</p>
            <p className="text-[11px] text-[#857368]">signed up</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-start gap-2" role="alert">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-[#EFE3D5] p-1 rounded-2xl gap-1">
          {[
            { key: 'mentors', label: `Mentors (${mentors.length})`, icon: Users },
            { key: 'students', label: `Students (${students.length})`, icon: GraduationCap },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                tab === key ? 'bg-white text-[#BA6838] shadow-xs' : 'text-[#7A6960] hover:text-[#261B14]'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#857368]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab} by name or email`}
            aria-label={`Search ${tab}`}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EFE4D8] rounded-xl text-sm text-[#261B14] focus:outline-none focus:border-[#BA6838]"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton w-full h-16" />
            <div className="skeleton w-full h-16" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-3xl text-center py-10 px-4 border border-dashed border-[#DDD8F0] text-xs text-[#857368]">
            {q ? 'No one matches your search.' : tab === 'mentors' ? 'No mentors yet — use “Add Mentor” to create one.' : 'No students have signed up yet.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((u) => (
              <li
                key={u.id}
                className={`bg-white rounded-2xl border border-[#EFE4D8] p-3 flex items-center gap-3 ${
                  tab === 'mentors' && !u.is_active ? 'opacity-60' : ''
                }`}
              >
                <Initial name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#261B14] truncate flex items-center gap-1.5">
                    {u.name}
                    {tab === 'mentors' && !u.is_active && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F6ECE2] text-[#7A6960]">
                        Deactivated
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[#857368] truncate">{u.email}</p>
                  <p className="text-[11px] text-[#857368] flex items-center gap-2">
                    {u.created_at && <span>Joined {formatDate(u.created_at)}</span>}
                    {tab === 'mentors' && u.running_series > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Repeat size={11} /> {u.running_series} series
                      </span>
                    )}
                  </p>
                </div>
                {tab === 'mentors' && (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => toggleMentor(u)}
                    className={`py-1.5 px-3 text-[11px] font-semibold rounded-lg flex-shrink-0 flex items-center gap-1 disabled:opacity-50 ${
                      u.is_active
                        ? 'text-red-700 bg-red-50 hover:bg-red-100'
                        : 'text-white bg-[#BA6838] hover:bg-[#A8582A]'
                    }`}
                  >
                    {busyId === u.id && <Loader2 size={12} className="animate-spin" />}
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
