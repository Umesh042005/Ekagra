import { useState } from 'react';
import { Calendar, Clock, Video, RotateCw, Trash2, User, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDateDetails, formatTimeDetails } from '../utils/dateUtils';

export default function UpcomingSessionCard({
  session = {},
  isCoach = false,
  onReschedule = null,
  onCancel = null,
  cancellingId = null,
}) {
  const {
    id,
    scheduled_at,
    zoom_link,
    session_title,
    session_type,
    topic,
    title,
    duration_minutes = 45,
    coach_name,
    student_name,
    platform,
  } = session;

  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const { dateStr, dayStr } = formatDateDetails(scheduled_at);
  const { timeStr, durationStr } = formatTimeDetails(scheduled_at, duration_minutes);

  const isMotivation = (session_type || '').toLowerCase() === 'motivation';
  const displayBadge = isMotivation ? 'Motivation Series' : '1:1 Study Session';

  // Title: prioritize session_title, topic, or fallback
  const displayTitle = session_title || title || (topic ? `1:1 Study: ${topic}` : 'Mindfulness & Focus Mentoring');
  const displayPlatform = platform || 'Zoom Meeting';
  const joinLink = zoom_link || 'https://zoom.us';

  const isCancelling = cancellingId === id;

  return (
    <div className="card bg-white rounded-3xl p-4 sm:p-5 border border-[#EFE4D8] shadow-sm fade-up space-y-4 hover:border-[#E2D2C3] transition-colors">
      {/* Top Header: Badge & Context */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
            isMotivation
              ? 'bg-[#EBF3ED] text-[#2C623B]'
              : 'bg-[#F9ECE3] text-[#BA6838]'
          }`}
        >
          {displayBadge}
        </span>

        {/* Status */}
        <span className="text-[11px] font-medium text-[#857368] capitalize">
          Upcoming
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-bold text-base sm:text-lg text-[#261B14] leading-snug">
          {displayTitle}
        </h3>
        {/* If study session with topic, show topic pill */}
        {!isMotivation && topic && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#7A6960]">
            <BookOpen size={13} className="text-[#BA6838]" />
            <span>Topic: <strong className="font-semibold text-[#261B14]">{topic}</strong></span>
          </div>
        )}
      </div>

      {/* Middle Row: Schedule Info (Left) + Meditation Illustration (Right) */}
      <div className="flex items-center justify-between gap-2">
        {/* Left Info List */}
        <div className="space-y-2.5 flex-1 min-w-0">
          {/* Date */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0E8] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar size={16} stroke="#BA6838" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#261B14] leading-tight">
                {dateStr}
              </p>
              <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                {dayStr}
              </p>
            </div>
          </div>

          {/* Time & Duration */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0E8] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock size={16} stroke="#BA6838" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#261B14] leading-tight">
                {timeStr}
              </p>
              <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                {durationStr}
              </p>
            </div>
          </div>

          {/* Participant Info */}
          {/* Coach View: Show student name */}
          {isCoach && student_name && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAF0E8] flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={16} stroke="#BA6838" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#261B14] leading-tight">
                  {student_name}
                </p>
                <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                  Student
                </p>
              </div>
            </div>
          )}

          {/* Student View: Show coach name ONLY for study session (NEVER for motivation) */}
          {!isCoach && !isMotivation && coach_name && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAF0E8] flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={16} stroke="#BA6838" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#261B14] leading-tight">
                  {coach_name}
                </p>
                <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                  Your Mentor
                </p>
              </div>
            </div>
          )}

          {/* Platform */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0E8] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Video size={16} stroke="#BA6838" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#261B14] leading-tight">
                {displayPlatform}
              </p>
              <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                Live Online Session
              </p>
            </div>
          </div>
        </div>

        {/* Right Meditation Illustration */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#FBF0E6] -z-0 opacity-80" />
          <svg viewBox="0 0 140 140" className="w-full h-full relative z-10" xmlns="http://www.w3.org/2000/svg">
            <g opacity="0.85">
              <path d="M40 80 Q30 40 45 25 Q55 45 40 80 Z" fill="#759A7E" />
              <path d="M35 50 Q20 30 15 45 Q28 55 35 50 Z" fill="#8CAE94" />
              <path d="M100 80 Q110 40 95 25 Q85 45 100 80 Z" fill="#759A7E" />
              <path d="M105 50 Q120 30 125 45 Q112 55 105 50 Z" fill="#8CAE94" />
              <path d="M70 45 Q70 15 70 12 Q78 28 70 45 Z" fill="#65886E" />
            </g>
            <path d="M32 108 C32 94 48 95 70 95 C92 95 108 94 108 108 C108 116 32 116 32 108 Z" fill="#375540" />
            <path d="M52 104 Q70 108 88 104" stroke="#2B4332" strokeWidth="1.5" fill="none" />
            <path d="M54 74 C54 74 60 70 70 70 C80 70 86 74 86 74 L89 97 L51 97 Z" fill="#BA6838" />
            <path d="M54 76 L40 92 L48 98" stroke="#BA6838" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M86 76 L100 92 L92 98" stroke="#BA6838" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="48" cy="98" r="3.5" fill="#F4C49F" />
            <circle cx="92" cy="98" r="3.5" fill="#F4C49F" />
            <path d="M66 62 H74 V72 H66 Z" fill="#E8B087" />
            <ellipse cx="70" cy="54" rx="11" ry="12" fill="#F4C49F" />
            <path d="M64 54 Q67 56 69 54" stroke="#4A3428" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M71 54 Q73 56 76 54" stroke="#4A3428" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M68 60 Q70 62 72 60" stroke="#BA6838" strokeWidth="1" strokeLinecap="round" fill="none" />
            <path d="M58 52 C58 43 62 38 70 38 C78 38 82 43 82 52 C80 47 75 44 70 44 C65 44 60 47 58 52 Z" fill="#261B14" />
            <circle cx="70" cy="35" r="6" fill="#261B14" />
          </svg>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        {/* Primary Join Button */}
        <a
          id={`join-session-${id || 'upcoming'}`}
          href={joinLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center justify-center gap-2 py-2.5 px-4 text-white font-semibold rounded-2xl transition-all w-full text-xs sm:text-sm"
          style={{
            background: '#BA6838',
            textDecoration: 'none',
            boxShadow: '0 3px 12px rgba(186, 104, 56, 0.25)',
          }}
        >
          <Video size={16} />
          <span>Join Session</span>
        </a>

        {/* Coach Management Buttons: Reschedule & Cancel */}
        {isCoach && (
          <>
            {showConfirmCancel ? (
              <div className="p-3 bg-red-50 rounded-2xl border border-red-200 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs text-red-700 font-semibold">
                  <AlertTriangle size={15} className="text-red-500" />
                  <span>Are you sure you want to cancel this session?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmCancel(false)}
                    className="flex-1 py-1.5 px-3 bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-xl hover:bg-gray-50"
                  >
                    Keep Session
                  </button>
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => {
                      if (onCancel) onCancel(id);
                      setShowConfirmCancel(false);
                    }}
                    className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-xs font-semibold text-white rounded-xl flex items-center justify-center gap-1 shadow-xs"
                  >
                    {isCancelling ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Yes, Cancel Slot</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onReschedule && onReschedule(session)}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-[#BA6838] bg-[#FAF0E7] hover:bg-[#F3E2D3] rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCw size={13} />
                  <span>Reschedule</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmCancel(true)}
                  className="py-2 px-3 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Cancel Slot</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
