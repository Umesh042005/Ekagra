import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Sparkles,
  ArrowRight,
  Info,
  BookOpen,
  User,
  Mail,
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ScheduleSessionModal from '../components/ScheduleSessionModal';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  getTodayInAppTime,
  getSessionDateKey,
  getSlotBounds,
  checkSlotOverlap,
} from '../utils/dateUtils';

function StudentAvatar({ avatarUrl, name, size = 'md' }) {
  const [imageError, setImageError] = useState(false);

  // Reset error state if avatarUrl changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
  };

  const iconSizes = {
    xs: 13,
    sm: 16,
    md: 20,
    lg: 32,
  };

  const hasPhoto = Boolean(avatarUrl && !imageError);

  return (
    <div
      className={`${sizeClasses[size] || sizeClasses.md} rounded-full overflow-hidden flex-shrink-0 border-2 border-[#BA6838]/30 bg-[#F6DFC9] flex items-center justify-center shadow-xs`}
    >
      {hasPhoto ? (
        <img
          src={avatarUrl}
          alt={name || 'Student'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
          <User size={iconSizes[size] || 20} />
        </div>
      )}
    </div>
  );
}

// Standard daily booking slots (24h format HH:MM)
const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Month navigation: year & month in IST (1-indexed: 1 = Jan, 12 = Dec)
  const today = getTodayInAppTime();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);

  // Selected calendar day (e.g. 15)
  const [selectedDay, setSelectedDay] = useState(today.day);

  // Booked slots from backend
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  // Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefilledDateTime, setPrefilledDateTime] = useState('');

  const [studentsError, setStudentsError] = useState('');

  // 1. Fetch Students
  const fetchStudents = async () => {
    setLoadingStudents(true);
    setStudentsError('');
    try {
      const res = await api.get('/coach/students');
      const data = res.data || [];
      setStudents(data);
      if (data.length > 0 && !selectedStudent) {
        setSelectedStudent(data[0]);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudentsError(err.response?.data?.detail || 'Failed to load students from server.');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 2. Fetch Availability when selected student or month changes
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const fetchAvailability = async () => {
    if (!selectedStudent) return;
    setLoadingAvailability(true);
    setAvailabilityError('');
    try {
      const res = await api.get(`/coach/students/${selectedStudent.id}/availability?month=${monthStr}`);
      const slots = Array.isArray(res.data) ? res.data : (res.data?.booked_slots || []);
      setBookedSlots(slots);
    } catch (err) {
      console.error('Failed to load student availability:', err);
      setAvailabilityError('Failed to load availability slots. Please try again.');
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [selectedStudent?.id, monthStr]);

  // Calendar Math
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  const firstDayWeekday = useMemo(() => {
    return new Date(year, month - 1, 1).getDay();
  }, [year, month]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  const handleGoToday = () => {
    const now = getTodayInAppTime();
    setYear(now.year);
    setMonth(now.month);
    setSelectedDay(now.day);
  };

  // Map booked slots by date (YYYY-MM-DD in IST)
  const bookedByDate = useMemo(() => {
    const map = {};
    for (const slot of bookedSlots) {
      const dateKey = getSessionDateKey(slot.scheduled_at);
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(slot);
      }
    }
    return map;
  }, [bookedSlots]);

  // Selected date string in local YYYY-MM-DD
  const selectedDateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const slotsForSelectedDay = bookedByDate[selectedDateStr] || [];

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Handle slot click
  const handleSlotClick = (timeStr, statusObj) => {
    if (statusObj.isBusy || statusObj.isPast) return;

    const { localIso } = getSlotBounds(year, month, selectedDay, timeStr, 45);
    setPrefilledDateTime(localIso);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2016] pb-24">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EFE4D8] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#BA6838]/10 text-[#BA6838] rounded-xl">
                <Users size={22} />
              </span>
              <h1 className="text-2xl font-bold font-serif text-[#2C2016]">
                Student Availability Calendar
              </h1>
            </div>
            <p className="text-sm text-[#8C7A70] mt-1">
              Inspect student schedules, check booked sessions, and book available 1:1 study slots.
            </p>
          </div>
        </div>

        {/* Top Controls: Student Selector & Search */}
        <div className="bg-white rounded-2xl p-5 border border-[#EFE4D8] shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7A70]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student by name or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#EFE4D8] bg-[#FAF7F2] text-sm text-[#2C2016] focus:outline-none focus:border-[#BA6838] transition-colors"
              />
            </div>

            {selectedStudent && (
              <div className="flex items-center gap-3 bg-[#FAF7F2] px-4 py-2 rounded-xl border border-[#EFE4D8]">
                <StudentAvatar avatarUrl={selectedStudent.avatar_url} name={selectedStudent.name} size="sm" />
                <div className="text-left">
                  <div className="text-[11px] text-[#8C7A70]">Currently Viewing:</div>
                  <div className="text-sm font-bold text-[#2C2016] leading-tight">{selectedStudent.name}</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Filter Pill Row */}
          {loadingStudents ? (
            <div className="text-sm text-[#8C7A70] py-2">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-sm text-[#8C7A70] py-2">No students match your search.</div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
              {filteredStudents.map((st) => {
                const isSelected = selectedStudent?.id === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setSelectedStudent(st);
                      setSelectedDay(today.getDate());
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#BA6838] text-white shadow-sm ring-2 ring-[#BA6838]/20'
                        : 'bg-[#FAF7F2] text-[#635147] hover:bg-[#F3ECE4] border border-[#EFE4D8]'
                    }`}
                  >
                    <StudentAvatar avatarUrl={st.avatar_url} name={st.name} size="xs" />
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Students Cards Section (Requirement 2) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#FAF0E7] text-[#BA6838] rounded-xl">
                <Users size={18} />
              </span>
              <h2 className="text-base font-bold text-[#2C2016]">
                Students Directory
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF0E7] text-[#BA6838]">
                {students.length}
              </span>
            </div>
            <span className="text-xs text-[#8C7A70] hidden sm:inline">
              Select any student card to view their availability calendar
            </span>
          </div>

          {loadingStudents ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : studentsError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-xs text-red-700 flex flex-col items-center justify-center gap-2">
              <span className="font-semibold">{studentsError}</span>
              <button
                onClick={fetchStudents}
                className="mt-1 px-4 py-1.5 bg-[#BA6838] text-white rounded-xl text-xs font-medium hover:bg-[#a0552b] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-[#EFE4D8] text-xs text-[#8C7A70]">
              {searchQuery.trim() ? `No students found matching "${searchQuery}"` : "No registered students found in the database."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredStudents.map((st) => {
                const isSelected = selectedStudent?.id === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setSelectedStudent(st);
                      setSelectedDay(today.getDate());
                      const el = document.getElementById('student-calendar-view');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                      isSelected
                        ? 'bg-[#FDF6F0] border-[#BA6838] ring-2 ring-[#BA6838]/20 shadow-xs'
                        : 'bg-white border-[#EFE4D8] hover:border-[#BA6838]/40'
                    }`}
                  >
                    {/* Small circular avatar next to name (Requirement 2) */}
                    <StudentAvatar avatarUrl={st.avatar_url} name={st.name} size="md" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-bold text-sm text-[#2C2016] truncate">
                          {st.name}
                        </h3>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-[#BA6838] bg-[#FAF0E7] px-2 py-0.5 rounded-full border border-[#BA6838]/20">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8C7A70] truncate mt-0.5">
                        {st.email}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-[#BA6838] font-semibold mt-1.5">
                        <CalendarIcon size={12} />
                        <span>View Calendar</span>
                        <ArrowRight size={11} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Student Detail / Availability Calendar (Requirement 3) ── */}
        {selectedStudent && (
          <div id="student-calendar-view" className="space-y-4 pt-2">
            {/* Prominent Student Header Banner (Requirement 3) */}
            <div className="bg-white rounded-3xl p-5 border border-[#EFE4D8] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 fade-up">
              <div className="flex items-center gap-4 min-w-0">
                {/* Prominent Profile Photo */}
                <StudentAvatar
                  avatarUrl={selectedStudent.avatar_url}
                  name={selectedStudent.name}
                  size="lg"
                />

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#2C2016] tracking-tight">
                      {selectedStudent.name}
                    </h2>
                    <span className="bg-[#FAF0E7] text-[#BA6838] text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-[#BA6838]/20">
                      Ekagra Student
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#8C7A70]">
                    <Mail size={13} className="text-[#BA6838]" />
                    <span className="truncate">{selectedStudent.email}</span>
                  </div>

                  <p className="text-[11.5px] text-[#7A6960]">
                    Visually inspecting availability calendar & booking slots for this student
                  </p>
                </div>
              </div>

              {/* Right Side: Month Stats & Book CTA */}
              <div className="flex items-center gap-2.5 self-start sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 border-[#F4E9DF] w-full sm:w-auto justify-between sm:justify-end">
                <div className="bg-[#FAF7F2] px-3.5 py-2 rounded-2xl border border-[#EFE4D8] text-center">
                  <span className="block text-[10px] uppercase font-bold text-[#8C7A70] tracking-wider">
                    {MONTH_NAMES[month - 1].slice(0, 3)} Bookings
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#BA6838]">
                    {bookedSlots.length} {bookedSlots.length === 1 ? 'slot' : 'slots'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPrefilledDateTime('');
                    setIsModalOpen(true);
                  }}
                  className="py-2.5 px-4 bg-[#BA6838] hover:bg-[#A8582A] text-white text-xs font-bold rounded-2xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CalendarIcon size={14} />
                  <span>Book Session</span>
                </button>
              </div>
            </div>

            {/* Calendar + Day Slots Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Monthly Calendar (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#EFE4D8] shadow-sm space-y-4">
              {/* Month Navigation Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#2C2016]">
                    {MONTH_NAMES[month - 1]} {year}
                  </h2>
                  <p className="text-xs text-[#8C7A70]">
                    Select a date to check availability
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleGoToday}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#FAF7F2] hover:bg-[#F3ECE4] border border-[#EFE4D8] text-[#635147] rounded-lg transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-[#FAF7F2] rounded-lg text-[#635147] border border-[#EFE4D8] transition-colors cursor-pointer"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-[#FAF7F2] rounded-lg text-[#635147] border border-[#EFE4D8] transition-colors cursor-pointer"
                    aria-label="Next Month"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 text-center border-b border-[#EFE4D8] pb-2 text-xs font-bold text-[#8C7A70]">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {/* Empty leading slots */}
                {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-14 rounded-xl opacity-20 bg-gray-50" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isToday =
                    today.year === year &&
                    today.month === month &&
                    today.day === dayNum;
                  const isSelected = selectedDay === dayNum;

                  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const sessionsOnDay = bookedByDate[dateKey] || [];
                  const busyCount = sessionsOnDay.length;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`h-14 rounded-xl p-1.5 flex flex-col justify-between items-center transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#BA6838] text-white border-[#BA6838] shadow-md ring-2 ring-[#BA6838]/20 scale-102 z-10'
                          : isToday
                          ? 'bg-amber-50/70 border-amber-300 text-[#2C2016]'
                          : 'bg-[#FAF7F2]/60 hover:bg-[#F3ECE4] border-[#EFE4D8] text-[#2C2016]'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                        {dayNum}
                      </span>

                      {/* Busy indicator badge */}
                      {busyCount > 0 ? (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {busyCount} busy
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-medium ${
                            isSelected ? 'text-white/80' : 'text-emerald-700'
                          }`}
                        >
                          free
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend Bar (Movie theater seat style) */}
              <div className="pt-3 border-t border-[#EFE4D8] flex flex-wrap items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-400" />
                  <span className="text-[#635147] font-medium">Available (Click to book)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300" />
                  <span className="text-[#635147] font-medium">Busy (Booked session)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-md bg-gray-100 border border-gray-300" />
                  <span className="text-[#635147] font-medium">Past slot</span>
                </div>
              </div>
            </div>

            {/* Right Column: Time Slots for Selected Day (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#EFE4D8] shadow-sm space-y-4">
              <div className="border-b border-[#EFE4D8] pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#2C2016] flex items-center gap-2">
                    <Clock size={18} className="text-[#BA6838]" />
                    <span>Time Slots</span>
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EFE4D8] text-[#8C7A70] font-medium">
                    {MONTH_NAMES[month - 1].slice(0, 3)} {selectedDay}, {year}
                  </span>
                </div>
                <p className="text-xs text-[#8C7A70] mt-1">
                  Click an available green slot to pre-fill and book a 1:1 study session.
                </p>
              </div>

              {/* Loading & Error States */}
              {loadingAvailability ? (
                <div className="py-12 text-center text-sm text-[#8C7A70]">
                  Loading availability slots...
                </div>
              ) : availabilityError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{availabilityError}</span>
                </div>
              ) : (
                /* Interactive Slots Grid */
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {TIME_SLOTS.map((slotTime) => {
                    const { startMs, endMs, isPast } = getSlotBounds(
                      year,
                      month,
                      selectedDay,
                      slotTime,
                      45
                    );

                    // Check if overlaps with any booked session
                    const overlappingSession = slotsForSelectedDay.find((b) =>
                      checkSlotOverlap(startMs, endMs, b)
                    );

                    const isBusy = !!overlappingSession;

                    if (isBusy) {
                      return (
                        <div
                          key={slotTime}
                          className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 cursor-not-allowed select-none"
                          title="This slot is already booked"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <div>
                              <div className="text-sm font-bold flex items-center gap-1.5">
                                <span>{slotTime}</span>
                                <span className="text-[11px] font-normal text-rose-700">
                                  ({overlappingSession.duration_minutes || 45} min)
                                </span>
                              </div>
                              <div className="text-[11px] text-rose-600 truncate max-w-[180px]">
                                {overlappingSession.session_title ||
                                  overlappingSession.topic ||
                                  `${overlappingSession.session_type === 'motivation' ? 'Motivation' : 'Study'} Session`}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-200 text-rose-800 uppercase tracking-wider">
                            Busy
                          </span>
                        </div>
                      );
                    }

                    if (isPast) {
                      return (
                        <div
                          key={slotTime}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                            <span className="text-sm font-medium">{slotTime}</span>
                          </div>
                          <span className="text-[11px] font-medium text-gray-400">
                            Past
                          </span>
                        </div>
                      );
                    }

                    // Available Slot
                    return (
                      <button
                        key={slotTime}
                        type="button"
                        onClick={() => handleSlotClick(slotTime, { isBusy: false, isPast: false })}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 transition-all hover:scale-[1.01] hover:shadow-sm cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:ring-2 ring-emerald-300 transition-all" />
                          <div>
                            <span className="text-sm font-bold text-emerald-900">{slotTime}</span>
                            {/* <span className="text-[11px] text-emerald-700 ml-2">45 mins</span> */}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 group-hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors">
                          <span>Available</span>
                          <ArrowRight size={13} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>

      {/* Reusable Booking Modal pre-filled with selected student and time slot */}
      <ScheduleSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchAvailability();
        }}
        currentCoachId={user?.id}
        initialStudentId={selectedStudent?.id || ''}
        initialDateTime={prefilledDateTime}
        initialSessionType="study"
      />

      <BottomNav />
    </div>
  );
}
