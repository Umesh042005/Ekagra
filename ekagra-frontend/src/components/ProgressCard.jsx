import { Flame, BookOpen, Sparkles, Calendar } from 'lucide-react';

export default function ProgressCard({ progress = null, isCoach = false }) {
  const streak = progress?.current_streak ?? 0;
  const completedStudy = progress?.completed_study_sessions ?? 0;
  const completedMotivation = progress?.completed_motivation_sessions ?? 0;
  const upcomingStudy = progress?.upcoming_study_sessions ?? 0;
  const upcomingMotivation = progress?.upcoming_motivation_sessions ?? 0;
  const totalUpcoming = upcomingStudy + upcomingMotivation;
  const totalCompleted = completedStudy + completedMotivation;

  return (
    <div className="card bg-white rounded-3xl p-4 sm:p-5 border border-[#EFE4D8] shadow-sm fade-up space-y-4">
      {/* Top Banner: Streak and Overview */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold text-[#857368] uppercase tracking-wider block">
            {isCoach ? 'Mentoring Journey' : 'Learning Consistency'}
          </span>
          <h3 className="font-bold text-lg text-[#261B14] leading-tight mt-0.5">
            Progress & Milestones
          </h3>
        </div>

        {/* Streak Visual Badge */}
        <div className="flex items-center gap-2 bg-[#FBF0E6] border border-[#F3DFC9] px-3.5 py-1.5 rounded-2xl shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-[#BA6838] flex items-center justify-center text-white flex-shrink-0 shadow-sm animate-pulse">
            <Flame size={18} fill="#FFFFFF" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-[#BA6838] leading-none">
                {streak}
              </span>
              <span className="text-[11px] font-bold text-[#857368]">
                {streak === 1 ? 'Session' : 'Sessions'}
              </span>
            </div>
            <span className="text-[10px] text-[#A67C52] font-semibold uppercase tracking-tight block">
              Current Streak
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Metric 1: Study Sessions */}
        <div className="bg-[#FAF4ED] border border-[#F1E5D8] rounded-2xl p-3 flex flex-col justify-between">
          <div className="w-7 h-7 rounded-lg bg-[#F2E1D0] flex items-center justify-center text-[#BA6838] mb-2">
            <BookOpen size={15} />
          </div>
          <div>
            <span className="text-xl font-bold text-[#261B14] block leading-none">
              {completedStudy}
            </span>
            <span className="text-[11px] font-medium text-[#7A6960] mt-1 block leading-tight">
              Study Sessions
            </span>
          </div>
        </div>

        {/* Metric 2: Motivation Sessions */}
        <div className="bg-[#EBF3ED] border border-[#D7E8DC] rounded-2xl p-3 flex flex-col justify-between">
          <div className="w-7 h-7 rounded-lg bg-[#D4E7DA] flex items-center justify-center text-[#406B49] mb-2">
            <Sparkles size={15} />
          </div>
          <div>
            <span className="text-xl font-bold text-[#204027] block leading-none">
              {completedMotivation}
            </span>
            <span className="text-[11px] font-medium text-[#4D6E54] mt-1 block leading-tight">
              Reflections
            </span>
          </div>
        </div>

        {/* Metric 3: Total Completed */}
        <div className="bg-[#F8F6F4] border border-[#ECE6DF] rounded-2xl p-3 flex flex-col justify-between">
          <div className="w-7 h-7 rounded-lg bg-[#EAE2D8] flex items-center justify-center text-[#695B50] mb-2">
            <Calendar size={15} />
          </div>
          <div>
            <span className="text-xl font-bold text-[#261B14] block leading-none">
              {totalCompleted}
            </span>
            <span className="text-[11px] font-medium text-[#7A6960] mt-1 block leading-tight">
              Total Done
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
