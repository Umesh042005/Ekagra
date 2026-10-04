import { useState, useEffect } from 'react';
import { X, Calendar, Clock, BookOpen, Sparkles, Users, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/axios';
import dayjs, { toUtcIsoFromLocal, APP_TIMEZONE } from '../utils/dateUtils';

export default function ScheduleSessionModal({
  isOpen,
  onClose,
  onSuccess,
  currentCoachId = null,
  initialStudentId = '',
  initialDateTime = '',
  initialSessionType = 'study',
}) {
  const [sessionType, setSessionType] = useState(initialSessionType); // 'study' | 'motivation'
  const [students, setStudents] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Study Session Form State
  const [studyStudentId, setStudyStudentId] = useState(initialStudentId);
  const [studyDateTime, setStudyDateTime] = useState(initialDateTime);
  const [studyDuration, setStudyDuration] = useState(45);
  const [studyTopic, setStudyTopic] = useState('');

  // Motivation Series Form State
  const [motiStudentId, setMotiStudentId] = useState(initialStudentId);
  const [motiStartDate, setMotiStartDate] = useState('');
  const [motiTimeOfDay, setMotiTimeOfDay] = useState('19:00');
  const [motiOngoing, setMotiOngoing] = useState(true);
  const [motiNumSessions, setMotiNumSessions] = useState(6);
  const [motiTitle, setMotiTitle] = useState('Evening Reflection Session');
  const [motiDuration, setMotiDuration] = useState(45);
  const [selectedCoachIds, setSelectedCoachIds] = useState([]);

  // Fetch available students & coaches when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuccessMsg('');
    if (initialSessionType) setSessionType(initialSessionType);

    async function loadOptions() {
      setLoadingData(true);
      try {
        const [studRes, coachRes] = await Promise.all([
          api.get('/coach/students').catch(() => ({ data: [] })),
          api.get('/coach/coaches').catch(() => ({ data: [] })),
        ]);

        const fetchedStudents = studRes.data || [];
        setStudents(fetchedStudents);
        if (initialStudentId) {
          setStudyStudentId(initialStudentId);
          setMotiStudentId(initialStudentId);
        } else if (fetchedStudents.length > 0) {
          setStudyStudentId(fetchedStudents[0].id);
          setMotiStudentId(fetchedStudents[0].id);
        }

        const fetchedCoaches = coachRes.data || [];
        setCoaches(fetchedCoaches);

        // Pre-select current coach in rotation list
        if (currentCoachId) {
          setSelectedCoachIds([currentCoachId]);
        } else if (fetchedCoaches.length > 0) {
          setSelectedCoachIds([fetchedCoaches[0].id]);
        }
      } catch (err) {
        console.error('Failed to load scheduling options:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadOptions();

    // Default study date/time if not provided (in IST)
    if (initialDateTime) {
      setStudyDateTime(initialDateTime);
    } else {
      const tomorrow = dayjs().tz(APP_TIMEZONE).add(1, 'day').hour(18).minute(0).second(0);
      setStudyDateTime(tomorrow.format('YYYY-MM-DDTHH:mm'));
    }

    // Default motivation start date to tomorrow in IST
    const tomorrow = dayjs().tz(APP_TIMEZONE).add(1, 'day');
    setMotiStartDate(tomorrow.format('YYYY-MM-DD'));
  }, [isOpen, currentCoachId, initialStudentId, initialDateTime, initialSessionType]);

  if (!isOpen) return null;

  // Coach checkbox toggle for motivation series
  const toggleCoach = (id) => {
    setSelectedCoachIds((prev) => {
      if (prev.includes(id)) {
        // Keep at least one coach
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (sessionType === 'study') {
        if (!studyStudentId) throw new Error('Please select a student.');
        if (!studyDateTime) throw new Error('Please choose session date and time.');

        const scheduledAtIso = toUtcIsoFromLocal(studyDateTime);

        await api.post('/coach/sessions/book-study', {
          student_id: studyStudentId,
          scheduled_at: scheduledAtIso,
          duration_minutes: Number(studyDuration),
          topic: studyTopic || undefined,
        });

        setSuccessMsg('1:1 Study Session scheduled successfully!');
      } else {
        if (!motiStudentId) throw new Error('Please select a student.');
        if (!motiStartDate) throw new Error('Please pick a start date.');
        if (!motiTimeOfDay) throw new Error('Please select a time of day.');
        if (selectedCoachIds.length === 0) throw new Error('Please select at least one mentor for rotation.');

        const { data } = await api.post('/coach/sessions/book-motivation-series', {
          student_id: motiStudentId,
          start_date: motiStartDate,
          time_of_day: motiTimeOfDay,
          // Omitting number_of_sessions makes the series ongoing (no end)
          number_of_sessions: motiOngoing ? undefined : Number(motiNumSessions),
          coach_ids: selectedCoachIds,
          session_title: motiTitle,
          duration_minutes: Number(motiDuration),
        });

        setSuccessMsg(data?.message || 'Motivation series scheduled successfully!');
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);

    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Scheduling failed. Please try again.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-[#EFE4D8] shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F4E9DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-[#261B14] leading-tight">
                Schedule a Session
              </h2>
              <p className="text-[11px] text-[#857368] leading-tight mt-0.5">
                Book a 1:1 study session or recurring reflection series
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#857368] hover:bg-[#F6ECE2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Switcher Tabs */}
        <div className="flex bg-[#F6ECE2] p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => { setSessionType('study'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              sessionType === 'study'
                ? 'bg-white text-[#BA6838] shadow-xs'
                : 'text-[#7A6960] hover:text-[#261B14]'
            }`}
          >
            <BookOpen size={14} />
            <span>1:1 Study Session</span>
          </button>
          <button
            type="button"
            onClick={() => { setSessionType('motivation'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              sessionType === 'motivation'
                ? 'bg-white text-[#BA6838] shadow-xs'
                : 'text-[#7A6960] hover:text-[#261B14]'
            }`}
          >
            <Sparkles size={14} />
            <span>Motivation Series</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
            <div className="leading-snug">
              <strong className="font-semibold block">Scheduling Conflict / Error:</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {loadingData ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#857368]">
            <Loader2 size={24} className="animate-spin text-[#BA6838]" />
            <span>Loading students and scheduling details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── 1:1 STUDY SESSION FORM ── */}
            {sessionType === 'study' && (
              <>
                {/* Student Select */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#261B14] block">
                    Select Student *
                  </label>
                  <select
                    value={studyStudentId}
                    onChange={(e) => setStudyStudentId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs font-medium text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                  >
                    {students.length === 0 ? (
                      <option value="">No students available</option>
                    ) : (
                      students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#261B14] block">
                      Date & Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={studyDateTime}
                      onChange={(e) => setStudyDateTime(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                    />
                    <span className="text-[10px] text-[#857368] block">
                      Must be at least 30 min in future
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#261B14] block">
                      Duration
                    </label>
                    <select
                      value={studyDuration}
                      onChange={(e) => setStudyDuration(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs font-medium text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes (Standard)</option>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                    </select>
                  </div>
                </div>

                {/* Topic */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#261B14] block">
                    Session Topic / Focus Area
                  </label>
                  <input
                    type="text"
                    value={studyTopic}
                    onChange={(e) => setStudyTopic(e.target.value)}
                    placeholder="e.g. Physics Thermodynamics, Time Management"
                    className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                  />
                </div>
              </>
            )}

            {/* ── MOTIVATION SERIES FORM ── */}
            {sessionType === 'motivation' && (
              <>
                {/* Student Select */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#261B14] block">
                    Select Student *
                  </label>
                  <select
                    value={motiStudentId}
                    onChange={(e) => setMotiStudentId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs font-medium text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                  >
                    {students.length === 0 ? (
                      <option value="">No students available</option>
                    ) : (
                      students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Start Date, Time & Number of Sessions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#261B14] block">
                      First Date *
                    </label>
                    <input
                      type="date"
                      value={motiStartDate}
                      onChange={(e) => setMotiStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#261B14] block">
                      Time of Day *
                    </label>
                    <input
                      type="time"
                      value={motiTimeOfDay}
                      onChange={(e) => setMotiTimeOfDay(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#261B14] block">
                      Length
                    </label>
                    {motiOngoing ? (
                      <div className="w-full px-3 py-2 bg-[#FDF0E6] border border-[#F1D9C4] rounded-xl text-xs font-semibold text-[#BA6838]">
                        Ongoing
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={motiNumSessions}
                        onChange={(e) => setMotiNumSessions(Number(e.target.value))}
                        required
                        aria-label="Number of sessions"
                        className="w-full px-3 py-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                      />
                    )}
                  </div>
                </div>

                {/* Ongoing vs fixed-length */}
                <div className="flex bg-[#EFE3D5] p-1 rounded-xl gap-1">
                  {[
                    { value: true, label: 'Ongoing (no end)' },
                    { value: false, label: 'Fixed number' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      aria-pressed={motiOngoing === opt.value}
                      onClick={() => setMotiOngoing(opt.value)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        motiOngoing === opt.value ? 'bg-white text-[#BA6838] shadow-xs' : 'text-[#7A6960] hover:text-[#261B14]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="p-2.5 bg-[#FAF4ED] border border-[#F1E5D8] rounded-xl text-[11px] text-[#7A6960] flex items-center gap-1.5">
                  <Clock size={13} className="text-[#BA6838] flex-shrink-0" />
                  <span>
                    Sessions occur on <strong>alternate days</strong> at {motiTimeOfDay} IST
                    {motiOngoing
                      ? <> and <strong>continue automatically</strong> until you pause or end the series.</>
                      : <> for {motiNumSessions} sessions.</>}
                  </span>
                </div>

                {/* Series Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#261B14] block">
                    Series Title
                  </label>
                  <input
                    type="text"
                    value={motiTitle}
                    onChange={(e) => setMotiTitle(e.target.value)}
                    required
                    placeholder="e.g. Evening Reflection Session"
                    className="w-full px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
                  />
                </div>

                {/* Coach Selection for Rotation */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#261B14] flex items-center gap-1">
                      <Users size={14} className="text-[#BA6838]" />
                      <span>Rotating Mentors *</span>
                    </label>
                    <span className="text-[10px] text-[#857368]">
                      Rotates round-robin each session
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl">
                    {coaches.length === 0 ? (
                      <span className="text-xs text-[#857368]">No other mentors registered</span>
                    ) : (
                      coaches.map((c) => {
                        const isChecked = selectedCoachIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isChecked ? 'bg-[#FDF0E6] text-[#261B14]' : 'hover:bg-white text-[#7A6960]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCoach(c.id)}
                              className="rounded text-[#BA6838] focus:ring-[#BA6838]"
                            />
                            <span className="font-medium">{c.name}</span>
                            <span className="text-[10.5px] text-[#857368] truncate">
                              ({c.email})
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-[#F4E9DF]">
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
                disabled={submitting || students.length === 0}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <Calendar size={14} />
                    <span>Confirm Booking</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
