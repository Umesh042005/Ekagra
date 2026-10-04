import { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, RotateCw } from 'lucide-react';
import api from '../api/axios';
import dayjs, { toLocalDatetimeInput, toUtcIsoFromLocal, APP_TIMEZONE } from '../utils/dateUtils';

export default function RescheduleModal({ isOpen, onClose, session, onSuccess }) {
  const [newDateTime, setNewDateTime] = useState('');
  const [newDuration, setNewDuration] = useState(45);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !session) return;
    setError('');
    setSuccessMsg('');

    // Pre-populate with current session time in IST or tomorrow
    const now = dayjs().tz(APP_TIMEZONE);
    let targetDt = session.scheduled_at ? dayjs.utc(session.scheduled_at).tz(APP_TIMEZONE) : now.add(1, 'day');
    if (targetDt.isBefore(now)) {
      targetDt = now.add(1, 'day');
    }
    setNewDateTime(targetDt.format('YYYY-MM-DDTHH:mm'));
    setNewDuration(session.duration_minutes || 45);
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDateTime) return;

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const scheduledIso = toUtcIsoFromLocal(newDateTime);

      await api.post(`/coach/sessions/${session.id}/reschedule`, {
        new_scheduled_at: scheduledIso,
        new_duration_minutes: Number(newDuration),
      });

      setSuccessMsg('Session rescheduled successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to reschedule session.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 border border-[#EFE4D8] shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#F4E9DF]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
              <RotateCw size={17} />
            </div>
            <h3 className="font-bold text-base text-[#261B14]">
              Reschedule Session
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#857368] hover:bg-[#F6ECE2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Session context */}
        <div className="p-3 bg-[#FAF6F2] rounded-2xl border border-[#EFE4D8] text-xs space-y-1">
          <p className="font-semibold text-[#261B14] truncate">
            {session.session_title || session.topic || 'Upcoming Session'}
          </p>
          {session.student_name && (
            <p className="text-[#857368]">
              Student: <span className="font-medium text-[#261B14]">{session.student_name}</span>
            </p>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700 animate-in fade-in">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleReschedule} className="space-y-3.5">
          {/* New Date and Time */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#261B14] block">
              New Date & Time *
            </label>
            <input
              type="datetime-local"
              value={newDateTime}
              onChange={(e) => setNewDateTime(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
            />
            <span className="text-[10px] text-[#857368] block">
              Must be at least 30 minutes in the future
            </span>
          </div>

          {/* New Duration */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#261B14] block">
              Duration
            </label>
            <select
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs font-medium text-[#261B14] focus:outline-none focus:border-[#BA6838]"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#F4E9DF]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-[#7A6960] bg-[#F6ECE2] hover:bg-[#EFE4D8] rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !newDateTime}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RotateCw size={14} />
                  <span>Reschedule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
