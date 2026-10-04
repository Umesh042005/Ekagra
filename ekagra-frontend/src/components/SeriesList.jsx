import { useState, useEffect, useCallback } from 'react';
import { Repeat, Pause, Play, Square, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { formatDate, toAppTime } from '../utils/dateUtils';

const STATUS_STYLES = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/** Mentor's recurring motivation series, with pause / resume / end controls. */
export default function SeriesList({ refreshKey = 0, onChanged }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const fetchSeries = useCallback(async () => {
    try {
      const res = await api.get('/coach/series');
      setSeries(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load series.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries, refreshKey]);

  const runAction = async (item, action) => {
    if (action === 'end' && !window.confirm(`End "${item.session_title}"? All future sessions in this series will be removed.`)) {
      return;
    }
    setBusyId(item.id);
    setError('');
    try {
      await api.post(`/coach/series/${item.id}/${action}`);
      await fetchSeries();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.detail || `Could not ${action} the series.`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading || (series.length === 0 && !error)) return null;

  return (
    <section className="space-y-2" aria-labelledby="series-heading">
      <h2 id="series-heading" className="text-xs font-bold text-[#635147] uppercase tracking-wide flex items-center gap-1.5">
        <Repeat size={13} className="text-[#BA6838]" />
        Recurring Series
      </h2>

      {error && <p className="text-xs text-red-700">{error}</p>}

      {series.map((item) => {
        const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.active;
        const busy = busyId === item.id;
        return (
          <div key={item.id} className="bg-white rounded-2xl border border-[#EFE4D8] p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#261B14] truncate">{item.session_title}</p>
                <p className="text-[11px] text-[#857368] mt-0.5">
                  {item.student_name || 'Student'} · alternate days at {item.time_of_day} IST ·{' '}
                  {item.max_sessions ? `${item.max_sessions} sessions` : 'ongoing'}
                </p>
                <p className="text-[11px] text-[#857368]">Mentors: {item.mentor_names.join(' → ')}</p>
                {item.status === 'active' && item.next_session_at && (
                  <p className="text-[11px] text-[#635147] font-medium mt-0.5">
                    Next: {formatDate(item.next_session_at, 'ddd, D MMM')} at {toAppTime(item.next_session_at).format('h:mm A')}
                  </p>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusStyle.className}`}>
                {statusStyle.label}
              </span>
            </div>

            <div className="flex gap-2">
              {item.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(item, 'pause')}
                  className="flex-1 py-1.5 px-3 text-[11px] font-semibold text-[#635147] bg-[#F6ECE2] hover:bg-[#EFE4D8] rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />} Pause
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(item, 'resume')}
                  className="flex-1 py-1.5 px-3 text-[11px] font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Resume
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(item, 'end')}
                className="flex-1 py-1.5 px-3 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Square size={12} /> End series
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
