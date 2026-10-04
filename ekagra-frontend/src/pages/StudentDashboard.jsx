import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Header from '../components/Header';
import GreetingCard from '../components/GreetingCard';
import TakeAPauseBanner from '../components/TakeAPauseBanner';
import UpcomingSessionCard from '../components/UpcomingSessionCard';
import BottomNav from '../components/BottomNav';

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [nextSessions, setNextSessions] = useState([]);
  const [emptyMsg, setEmptyMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchHomeData = useCallback(async () => {
    try {
      // scope=next returns at most 2 items: 1 next study session + 1 next motivation session
      const [profileRes, upcomingRes] = await Promise.all([
        api.get('/student/profile').catch(() => ({ data: { name: 'Student' } })),
        api.get('/student/sessions/upcoming?scope=next').catch(() => ({ data: { sessions: [] } })),
      ]);

      setProfile(profileRes.data || { name: 'Student' });

      const fetchedList = Array.isArray(upcomingRes.data)
        ? upcomingRes.data
        : upcomingRes.data?.sessions || [];
      setNextSessions(fetchedList);
      setEmptyMsg(upcomingRes.data?.message || 'No upcoming sessions this week.');
    } catch (err) {
      console.error('Failed to load student home data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  return (
    <div className="min-h-dvh pb-28 relative overflow-x-hidden" style={{ background: '#F6ECE2' }}>
      {/* Background foliage decor */}
      <div className="fixed top-0 left-0 w-32 h-64 pointer-events-none opacity-35 -z-0">
        <svg viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M-20 20 Q40 60 20 120 Q-10 180 10 220" stroke="#7A9380" strokeWidth="2.5" />
          <ellipse cx="28" cy="70" rx="14" ry="30" transform="rotate(35 28 70)" fill="#8FA995" />
          <ellipse cx="10" cy="130" rx="14" ry="28" transform="rotate(-30 10 130)" fill="#7A9380" />
        </svg>
      </div>

      <div className="fixed bottom-10 right-0 w-36 h-72 pointer-events-none opacity-30 -z-0">
        <svg viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M120 20 Q60 70 80 140 Q110 190 90 220" stroke="#7A9380" strokeWidth="2.5" />
          <ellipse cx="72" cy="80" rx="14" ry="30" transform="rotate(-35 72 80)" fill="#8FA995" />
          <ellipse cx="88" cy="145" rx="14" ry="28" transform="rotate(30 88 145)" fill="#7A9380" />
        </svg>
      </div>

      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 py-4 space-y-4 relative z-10">
        {/* 1. Greeting Card with interactive avatar */}
        {loading ? (
          <div className="skeleton w-full h-24" />
        ) : (
          <GreetingCard
            name={profile?.name || 'Student'}
            avatarUrl={profile?.avatar_url}
            onAvatarUpdated={(newUrl) => {
              setProfile((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
            }}
          />
        )}

        {/* 2. Take a Pause Banner */}
        <TakeAPauseBanner />

        {/* 3. Next Upcoming Session(s) Summary (Max 2 cards: 1 study + 1 motivation) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[17px] sm:text-lg text-[#261B14] tracking-tight">
                Your Next Session
              </h2>
              <p className="text-[11px] text-[#857368]">
                Quick glance at what's immediately ahead
              </p>
            </div>

            {/* View All Sessions Link */}
            <button
              id="view-all-sessions-btn"
              type="button"
              onClick={() => navigate('/student/sessions')}
              className="flex items-center gap-0.5 text-xs font-bold hover:opacity-80 transition-opacity text-[#BA6838] cursor-pointer"
            >
              <span>View All Sessions</span>
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>

          {loading ? (
            <div className="skeleton w-full h-44" />
          ) : nextSessions.length > 0 ? (
            <div className="space-y-3">
              {nextSessions.map((session) => (
                <UpcomingSessionCard
                  key={session.id}
                  session={session}
                  isCoach={false}
                />
              ))}
            </div>
          ) : (
            <div className="card bg-white rounded-3xl p-6 text-center border border-[#EFE4D8] space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838] mx-auto">
                <Calendar size={20} />
              </div>
              <p className="font-semibold text-sm text-[#261B14]">
                {emptyMsg || 'No sessions scheduled this week'}
              </p>
              <p className="text-xs text-[#857368] max-w-xs mx-auto">
                Your mentor will schedule your next study or motivation session soon.
              </p>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
