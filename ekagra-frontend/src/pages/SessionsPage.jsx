import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import UpcomingSessionCard from '../components/UpcomingSessionCard';
import CompletedSessionCard from '../components/CompletedSessionCard';
import ScheduleSessionModal from '../components/ScheduleSessionModal';
import RescheduleModal from '../components/RescheduleModal';
import SeriesList from '../components/SeriesList';
import BottomNav from '../components/BottomNav';

export default function SessionsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const isCoach = role === 'coach';
  const prefix = isCoach ? '/coach' : '/student'; // API path prefix (backend keeps /coach)

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed'
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Coach modal states
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [upRes, compRes] = await Promise.all([
        api.get(`${prefix}/sessions/upcoming?scope=all`).catch(() => ({ data: { sessions: [] } })),
        api.get(`${prefix}/sessions/completed`).catch(() => ({ data: { sessions: [] } })),
      ]);

      const upList = Array.isArray(upRes.data) ? upRes.data : upRes.data?.sessions || [];
      const compList = Array.isArray(compRes.data) ? compRes.data : compRes.data?.sessions || [];

      setUpcomingSessions(upList);
      setCompletedSessions(compList);
    } catch (err) {
      setError('Unable to load session history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Cancel Handler for Coaches
  const handleCancelSession = async (sessionId) => {
    setCancellingId(sessionId);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/coach/sessions/${sessionId}/cancel`);
      setNotice(res.data?.message || 'Session cancelled successfully.');
      await fetchSessions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel session.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-dvh pb-28 relative overflow-x-hidden" style={{ background: '#F6ECE2' }}>
      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 py-4 space-y-4 relative z-10">
        {/* Page Title & Context */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-xl sm:text-2xl text-[#261B14] tracking-tight">
              All Sessions
            </h1>
            <p className="text-xs text-[#857368] mt-0.5">
              {isCoach
                ? 'Manage your scheduled 1:1 and group reflection series'
                : 'Your complete learning and reflection timeline'}
            </p>
          </div>

          {/* Coach Schedule & Availability CTAs */}
          {isCoach && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/mentor/students')}
                className="py-2.5 px-3 bg-white hover:bg-[#FAF7F2] text-[#635147] border border-[#EFE4D8] font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Users size={14} className="text-[#BA6838]" strokeWidth={2.5} />
                <span>Availability</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScheduleOpen(true)}
                className="py-2.5 px-3.5 bg-[#BA6838] hover:bg-[#A8582A] text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Schedule</span>
              </button>
            </div>
          )}
        </div>

        {/* Notices & Errors */}
        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="text-emerald-700 ml-2">✕</button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 text-red-500 flex-shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Mentor: recurring series management */}
        {isCoach && <SeriesList refreshKey={seriesRefreshKey} onChanged={fetchSessions} />}

        {/* Navigation Tabs: Upcoming vs Completed */}
        <div className="flex bg-[#EFE3D5] p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-white text-[#BA6838] shadow-xs'
                : 'text-[#7A6960] hover:text-[#261B14]'
            }`}
          >
            <Clock size={14} />
            <span>Upcoming ({upcomingSessions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-white text-[#BA6838] shadow-xs'
                : 'text-[#7A6960] hover:text-[#261B14]'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Completed ({completedSessions.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton w-full h-36" />
            <div className="skeleton w-full h-36" />
          </div>
        ) : activeTab === 'upcoming' ? (
          /* Upcoming Sessions List (Full series) */
          <div className="space-y-3">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session) => (
                <UpcomingSessionCard
                  key={session.id}
                  session={session}
                  isCoach={isCoach}
                  onReschedule={(s) => setRescheduleTarget(s)}
                  onCancel={handleCancelSession}
                  cancellingId={cancellingId}
                />
              ))
            ) : (
              <div className="card bg-white rounded-3xl text-center py-10 px-4 border border-dashed border-[#DDD8F0] space-y-2">
                <p className="text-3xl">📅</p>
                <p className="text-sm font-semibold text-[#261B14]">
                  No upcoming sessions scheduled
                </p>
                <p className="text-xs text-[#857368] max-w-xs mx-auto">
                  {isCoach
                    ? 'Use the Schedule button above to set up your next student session.'
                    : 'Your mentor will schedule your next study or motivation session soon.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Completed Sessions List */
          <div className="space-y-2.5">
            {completedSessions.length > 0 ? (
              completedSessions.map((session, idx) => (
                <CompletedSessionCard
                  key={session.id}
                  session={session}
                  iconType={idx % 3 === 0 ? 'leaf' : idx % 3 === 1 ? 'brain' : 'heart'}
                />
              ))
            ) : (
              <div className="card bg-white rounded-3xl text-center py-10 px-4 border border-[#EFE4D8] text-xs text-[#857368] space-y-1">
                <p className="text-2xl">🌱</p>
                <p className="font-semibold text-[#261B14]">No completed sessions yet</p>
                <p>Sessions will automatically appear here once their time has passed.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Schedule Session Modal for Coach */}
      {isCoach && (
        <ScheduleSessionModal
          isOpen={isScheduleOpen}
          onClose={() => setIsScheduleOpen(false)}
          onSuccess={() => {
            setNotice('New session scheduled successfully!');
            fetchSessions();
            setSeriesRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Reschedule Modal for Coach */}
      {isCoach && (
        <RescheduleModal
          isOpen={!!rescheduleTarget}
          session={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => {
            setNotice('Session rescheduled successfully!');
            fetchSessions();
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
