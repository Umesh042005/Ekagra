import { useState, useEffect } from 'react';
import { Camera, Mail, Shield, LogOut, Settings, Bell, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import AvatarUploadModal from '../components/AvatarUploadModal';
import BottomNav from '../components/BottomNav';

export default function ProfilePage() {
  const { role, logout } = useAuth();
  const isCoach = role === 'coach';
  const prefix = isCoach ? '/coach' : '/student'; // API path prefix (backend keeps /coach)
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get(`${prefix}/profile`);
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [prefix]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh pb-28 relative overflow-x-hidden" style={{ background: '#F6ECE2' }}>
      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 py-4 space-y-4 relative z-10">
        {/* Page Title */}
        <div>
          <h1 className="font-bold text-xl sm:text-2xl text-[#261B14] tracking-tight">
            Account Profile
          </h1>
          <p className="text-xs text-[#857368] mt-0.5">
            Manage your personal information, profile photo, and preferences
          </p>
        </div>

        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="skeleton w-full h-48" />
            <div className="skeleton w-full h-36" />
          </div>
        ) : (
          <>
            {/* 1. Profile Identity Card */}
            <div className="card bg-white rounded-3xl p-6 border border-[#EFE4D8] shadow-sm flex flex-col items-center text-center space-y-3.5 fade-up">
              {/* Avatar with Camera badge */}
              <div className="relative group">
                <div
                  onClick={() => setShowAvatarModal(true)}
                  className="w-24 h-24 rounded-full overflow-hidden border-3 border-[#BA6838]/40 bg-[#F6DFC9] shadow-md cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
                  title="Change profile photo"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={48} className="text-[#BA6838]/70" />
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                    <Camera size={22} className="text-white" />
                  </div>
                </div>

                {/* Camera badge icon */}
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#BA6838] text-white flex items-center justify-center shadow-md hover:bg-[#A8582A] transition-colors"
                  aria-label="Upload photo"
                >
                  <Camera size={14} />
                </button>
              </div>

              {/* Name & Role */}
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#261B14] leading-tight">
                  {profile?.name || 'User'}
                </h2>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#857368]">
                  <Mail size={13} />
                  <span>{profile?.email || 'user@ekagra.com'}</span>
                </div>
                <div className="pt-1">
                  <span className="inline-block bg-[#FDF0E6] text-[#BA6838] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {isCoach ? 'Verified Mentor' : 'Ekagra Student'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Account Information Details */}
            <div className="card bg-white rounded-3xl p-5 border border-[#EFE4D8] shadow-sm space-y-3.5 fade-up">
              <h3 className="font-bold text-sm text-[#261B14] pb-2 border-b border-[#F4E9DF]">
                Account Details
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#857368] font-medium">Account Role</span>
                  <span className="font-semibold text-[#261B14] capitalize">
                    {profile?.role || role}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#FAF4EE]">
                  <span className="text-[#857368] font-medium">Email Address</span>
                  <span className="font-semibold text-[#261B14]">
                    {profile?.email}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#FAF4EE]">
                  <span className="text-[#857368] font-medium">Account Status</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                    <CheckCircle2 size={12} />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Settings Quick Links */}
            <div className="card bg-white rounded-3xl p-3 border border-[#EFE4D8] shadow-sm space-y-1 fade-up">
              <button
                type="button"
                onClick={() => setNotice('Notification preferences are up to date.')}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-[#FAF6F2] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#261B14]">Notifications</p>
                    <p className="text-[10.5px] text-[#857368]">Email & in-app alerts</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#B5A599]" />
              </button>

              <button
                type="button"
                onClick={() => setNotice('Privacy and data settings are active.')}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-[#FAF6F2] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#EBF3ED] flex items-center justify-center text-[#406B49]">
                    <Shield size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#261B14]">Privacy & Security</p>
                    <p className="text-[10.5px] text-[#857368]">Protected by Supabase Auth</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#B5A599]" />
              </button>
            </div>

            {/* 4. Logout CTA */}
            <button
              id="profile-logout-btn"
              type="button"
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-xs rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              <span>Sign Out of Ekagra</span>
            </button>
          </>
        )}
      </main>

      <AvatarUploadModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentAvatar={profile?.avatar_url}
        onUploaded={(newUrl) => {
          setProfile((p) => (p ? { ...p, avatar_url: newUrl } : p));
          setNotice('Profile photo updated successfully!');
        }}
      />

      <BottomNav />
    </div>
  );
}
