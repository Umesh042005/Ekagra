import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, Plus, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Header from '../components/Header';
import GreetingCard from '../components/GreetingCard';
import TakeAPauseBanner from '../components/TakeAPauseBanner';
import UpcomingSessionCard from '../components/UpcomingSessionCard';
import ScheduleSessionModal from '../components/ScheduleSessionModal';
import RescheduleModal from '../components/RescheduleModal';
import BottomNav from '../components/BottomNav';

export default function CoachDashboard() {
  const [profile, setProfile] = useState(null);
  const [nextSessions, setNextSessions] = useState([]);
  const [emptyMsg, setEmptyMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [rescheduleSession, setRescheduleSession] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const navigate = useNavigate();

  const fetchHomeData = useCallback(async () => {
    try {
      // scope=next returns at most 2 items: 1 next study session + 1 next motivation session
      const [profileRes, upcomingRes] = await Promise.all([
        api.get('/coach/profile').catch(() => ({ data: null })),
        api.get('/coach/sessions/upcoming?scope=next').catch(() => ({ data: { sessions: [] } })),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      const fetchedList = Array.isArray(upcomingRes.data)
        ? upcomingRes.data
        : upcomingRes.data?.sessions || [];
      setNextSessions(fetchedList);
      setEmptyMsg(upcomingRes.data?.message || 'No upcoming sessions scheduled this week.');
    } catch (err) {
      console.error('Failed to load coach home data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  // Cancel Handler
  const handleCancelSession = async (sessionId) => {
    setCancellingId(sessionId);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/coach/sessions/${sessionId}/cancel`);
      setNotice(res.data?.message || 'Session cancelled successfully.');
      await fetchHomeData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel session.');
    } finally {
      setCancellingId(null);
    }
  };

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

      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 py-4 space-y-4 relative z-10">
        {/* 1. Greeting Card with avatar upload */}
        {loading ? (
          <div className="skeleton w-full h-24" />
        ) : (
          <GreetingCard
            name={profile?.name || 'Mentor'}
            avatarUrl={profile?.avatar_url}
            onAvatarUpdated={(newUrl) => {
              setProfile((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
              setNotice('Profile photo updated successfully!');
            }}
          />
        )}

        {/* Notices & Errors */}
        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="text-emerald-700 ml-2">✕</button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-start justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-700 ml-2">✕</button>
          </div>
        )}

        {/* 2. Primary CTAs: Schedule Session & Student Availability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="coach-schedule-btn"
            type="button"
            onClick={() => setIsScheduleOpen(true)}
            className="w-full py-3.5 px-4 bg-[#BA6838] hover:bg-[#A8582A] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            style={{ boxShadow: '0 4px 16px rgba(186, 104, 56, 0.28)' }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Schedule Session</span>
          </button>

          <button
            id="coach-students-calendar-btn"
            type="button"
            onClick={() => navigate('/mentor/students')}
            className="w-full py-3.5 px-4 bg-white hover:bg-[#FAF7F2] text-[#635147] border border-[#EFE4D8] font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Users size={18} className="text-[#BA6838]" strokeWidth={2.5} />
            <span>Student Availability</span>
          </button>
        </div>

        {/* 3. Take a Pause Banner */}
        <TakeAPauseBanner />

        {/* 4. Single Next Upcoming Session(s) Summary (Max 2 cards: 1 study + 1 motivation) */}
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
              id="coach-view-all-sessions-btn"
              type="button"
              onClick={() => navigate('/mentor/sessions')}
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
                  isCoach={true}
                  onReschedule={(s) => setRescheduleSession(s)}
                  onCancel={handleCancelSession}
                  cancellingId={cancellingId}
                />
              ))}
            </div>
          ) : (
            <div className="card bg-white rounded-3xl p-6 text-center border border-[#EFE4D8] space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838] mx-auto">
                <Calendar size={20} />
              </div>
              <p className="font-semibold text-sm text-[#261B14]">
                {emptyMsg || 'No upcoming sessions scheduled'}
              </p>
              <p className="text-xs text-[#857368] max-w-xs mx-auto">
                Use the Schedule button above to set up a study session or reflection series.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Schedule Modal */}
      <ScheduleSessionModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onSuccess={() => {
          setNotice('Session scheduled successfully!');
          fetchHomeData();
        }}
        currentCoachId={profile?.id}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={!!rescheduleSession}
        session={rescheduleSession}
        onClose={() => setRescheduleSession(null)}
        onSuccess={() => {
          setNotice('Session rescheduled successfully!');
          fetchHomeData();
        }}
      />

      <BottomNav />
    </div>
  );
}
