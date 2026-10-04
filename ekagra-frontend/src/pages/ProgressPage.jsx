import { useState, useEffect } from 'react';
import { Flame, BookOpen, Sparkles, Calendar, CheckCircle2, TrendingUp, Award, Clock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function ProgressPage() {
  const { role } = useAuth();
  const isCoach = role === 'coach';
  const prefix = isCoach ? '/coach' : '/student'; // API path prefix (backend keeps /coach)

  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await api.get(`${prefix}/progress`);
        setProgress(res.data);
      } catch (err) {
        setError('Failed to load progress metrics. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, [prefix]);

  const thisWeek = progress?.this_week || {
    upcoming_study_sessions: progress?.upcoming_study_sessions ?? 0,
    upcoming_motivation_sessions: progress?.upcoming_motivation_sessions ?? 0,
    completed_study_sessions: progress?.completed_study_sessions ?? 0,
    completed_motivation_sessions: progress?.completed_motivation_sessions ?? 0,
  };

  const overall = progress?.overall || {
    total_study_sessions: progress?.completed_study_sessions ?? 0,
    total_motivation_sessions: progress?.completed_motivation_sessions ?? 0,
    current_streak: progress?.current_streak ?? 0,
  };

  const streak = overall.current_streak ?? 0;

  return (
    <div className="min-h-dvh pb-28 relative overflow-x-hidden" style={{ background: '#F6ECE2' }}>
      <Header />

      <main className="max-w-md md:max-w-xl mx-auto px-4 py-4 space-y-5 relative z-10">
        {/* Page Title */}
        <div>
          <span className="text-[11px] font-bold text-[#BA6838] uppercase tracking-wider block">
            {isCoach ? 'Mentor Analytics' : 'Student Journey'}
          </span>
          <h1 className="font-bold text-xl sm:text-2xl text-[#261B14] tracking-tight">
            Progress & Consistency
          </h1>
          <p className="text-xs text-[#857368] mt-0.5">
            Track weekly session commitments and your long-term mindfulness habit
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="skeleton w-full h-44" />
            <div className="skeleton w-full h-44" />
          </div>
        ) : (
          <>
            {/* ────────────────────────────────────────────────────────── */}
            {/* SECTION A: THIS WEEK (Rolling 7-Day Window)               */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="card bg-white rounded-3xl p-5 border border-[#EFE4D8] shadow-sm space-y-4 fade-up">
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E9DF]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-[#261B14] leading-tight">
                      This Week
                    </h2>
                    <p className="text-[11px] text-[#857368] leading-tight">
                      Rolling 7-day scheduled & completed sessions
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#BA6838] bg-[#FDF0E6] px-2.5 py-1 rounded-full">
                  7 Days
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Upcoming Study Sessions */}
                <div className="bg-[#FAF4ED] border border-[#F1E5D8] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#857368]">Upcoming Study</span>
                    <BookOpen size={14} className="text-[#BA6838]" />
                  </div>
                  <div className="text-2xl font-black text-[#261B14]">
                    {thisWeek.upcoming_study_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#A67C52] block leading-tight">
                    1:1 Sessions scheduled
                  </span>
                </div>

                {/* 2. Upcoming Motivation Sessions */}
                <div className="bg-[#EBF3ED] border border-[#D7E8DC] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#4D6E54]">Upcoming Reflection</span>
                    <Sparkles size={14} className="text-[#406B49]" />
                  </div>
                  <div className="text-2xl font-black text-[#204027]">
                    {thisWeek.upcoming_motivation_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#527D5E] block leading-tight">
                    Reflection sessions ahead
                  </span>
                </div>

                {/* 3. Completed Study Sessions */}
                <div className="bg-[#F8F6F4] border border-[#ECE6DF] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#695B50]">Completed Study</span>
                    <CheckCircle2 size={14} className="text-[#8C7A70]" />
                  </div>
                  <div className="text-2xl font-black text-[#261B14]">
                    {thisWeek.completed_study_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#857368] block leading-tight">
                    Attended this week
                  </span>
                </div>

                {/* 4. Completed Motivation Sessions */}
                <div className="bg-[#F8F6F4] border border-[#ECE6DF] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#695B50]">Completed Reflection</span>
                    <CheckCircle2 size={14} className="text-[#8C7A70]" />
                  </div>
                  <div className="text-2xl font-black text-[#261B14]">
                    {thisWeek.completed_motivation_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#857368] block leading-tight">
                    Reflected this week
                  </span>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* SECTION B: OVERALL (All-Time Totals & Streak)             */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="card bg-white rounded-3xl p-5 border border-[#EFE4D8] shadow-sm space-y-4 fade-up">
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E9DF]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-[#261B14] leading-tight">
                      Overall Consistency
                    </h2>
                    <p className="text-[11px] text-[#857368] leading-tight">
                      All-time totals & active attendance streak
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#406B49] bg-[#EBF3ED] px-2.5 py-1 rounded-full">
                  All-Time
                </span>
              </div>

              {/* Prominent Streak Card with Flame Animation */}
              <div className="bg-gradient-to-r from-[#FAF0E7] to-[#FDF6F0] border border-[#F3DFC9] rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#BA6838] text-white flex items-center justify-center shadow-md animate-pulse">
                    <Flame size={26} fill="#FFFFFF" strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#BA6838] uppercase tracking-wider block">
                      Active Streak
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-[#261B14]">
                        {streak}
                      </span>
                      <span className="text-xs font-semibold text-[#857368]">
                        Consecutive {streak === 1 ? 'Session' : 'Sessions'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <Award size={22} className="text-[#BA6838] ml-auto mb-0.5 opacity-80" />
                  <span className="text-[10px] font-medium text-[#7A6960] block">
                    Zero Missed
                  </span>
                </div>
              </div>

              {/* All-time totals grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Total Study Sessions */}
                <div className="bg-[#FAF6F2] border border-[#EFE4D8] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#857368]">Total Study Done</span>
                    <BookOpen size={14} className="text-[#BA6838]" />
                  </div>
                  <div className="text-2xl font-black text-[#261B14]">
                    {overall.total_study_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#A67C52] block leading-tight">
                    All-time study sessions
                  </span>
                </div>

                {/* Total Motivation Sessions */}
                <div className="bg-[#FAF6F2] border border-[#EFE4D8] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#857368]">Total Reflections Done</span>
                    <Sparkles size={14} className="text-[#406B49]" />
                  </div>
                  <div className="text-2xl font-black text-[#261B14]">
                    {overall.total_motivation_sessions}
                  </div>
                  <span className="text-[10.5px] text-[#527D5E] block leading-tight">
                    All-time motivation sessions
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
