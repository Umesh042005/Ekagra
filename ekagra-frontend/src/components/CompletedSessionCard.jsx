import { CheckCircle2, Clock, ChevronRight, Brain, Heart, Sparkles, BookOpen } from 'lucide-react';
import { formatDate, formatTime } from '../utils/dateUtils';

export default function CompletedSessionCard({ session = {}, iconType = 'leaf' }) {
  const {
    scheduled_at,
    session_title,
    session_type,
    topic,
    title,
    duration_minutes = 45,
  } = session;

  const isMotivation = (session_type || '').toLowerCase() === 'motivation';

  const displayTitle = session_title || title || (
    topic ? `Study: ${topic}` :
    iconType === 'leaf'
      ? 'Stress Management Basics'
      : iconType === 'brain'
      ? 'Focus & Study Techniques'
      : 'Building Healthy Habits'
  );

  const displayDate = session.date || formatDate(scheduled_at);
  const displayTime = session.time || formatTime(scheduled_at);
  const durationText = `${duration_minutes} minutes`;

  return (
    <div className="card bg-white rounded-2xl p-3.5 sm:p-4 border border-[#EFE4D8] shadow-xs fade-up flex items-center justify-between gap-3 hover:border-[#DECBC0] transition-colors">
      {/* Left: Themed Circular Icon */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
            isMotivation || iconType === 'leaf' ? 'bg-[#EEF5F0]' : 'bg-[#FAF0E7]'
          }`}
        >
          {isMotivation ? (
            <Sparkles size={18} stroke="#4A7C59" />
          ) : iconType === 'leaf' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3C12 3 9 7 9 11C9 13.5 10.5 15.5 12 16C13.5 15.5 15 13.5 15 11C15 7 12 3 12 3Z"
                fill="#4A7C59"
              />
              <path
                d="M7 9C7 9 6.5 12.5 8.5 14.5C9.5 15.5 12 16 12 16C12 16 10.5 13.5 10 11.5C9.5 9.5 7 9 7 9Z"
                fill="#619470"
              />
              <path
                d="M17 9C17 9 17.5 12.5 15.5 14.5C14.5 15.5 12 16 12 16C12 16 13.5 13.5 14 11.5C14.5 9.5 17 9 17 9Z"
                fill="#619470"
              />
              <path d="M12 16V21" stroke="#376043" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : iconType === 'brain' ? (
            <Brain size={20} stroke="#BA6838" strokeWidth={1.8} />
          ) : (
            <Heart size={20} stroke="#BA6838" strokeWidth={1.8} />
          )}
        </div>

        {/* Middle: Title, Date/Time, Duration */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-sm text-[#261B14] leading-tight truncate">
              {displayTitle}
            </h4>
          </div>
          <p className="text-xs text-[#857368] leading-tight mt-1">
            {displayDate} • {displayTime}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-[#857368] leading-tight mt-1">
            <Clock size={11} stroke="#BA6838" />
            <span>{durationText}</span>
            {topic && (
              <>
                <span className="text-[#BA6838]">•</span>
                <span className="truncate">{topic}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Completed badge + Chevron */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="bg-[#E7F3E9] text-[#2E7342] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 size={13} className="text-[#2E7342]" />
          <span>Completed</span>
        </span>
        <ChevronRight size={16} className="text-[#B5A599]" />
      </div>
    </div>
  );
}
