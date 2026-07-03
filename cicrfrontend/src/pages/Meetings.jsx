import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  MapPin,
  Plus,
  Search,
  Video,
  Play,
} from 'lucide-react';
import { fetchMeetings, scheduleMeeting } from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const parseDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return 'TBD';
  return parsed.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return '--:--';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getMeetingState = (meeting) => {
  const start = parseDate(meeting.startTime);
  const end = parseDate(meeting.endTime);
  const now = new Date();

  if (!start || !end) return { id: 'upcoming', label: 'Scheduled', color: 'cyan' };
  if (start <= now && end >= now) return { id: 'live', label: 'Live Now', color: 'emerald' };
  if (start > now) return { id: 'upcoming', label: 'Upcoming', color: 'cyan' };
  return { id: 'past', label: 'Completed', color: 'gray' };
};

function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) {
        setTimeLeft('Starting soon...');
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`In ${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className="font-mono text-sm tracking-wider bg-slate-200 px-2 py-1 rounded-md">{timeLeft || 'Calculating...'}</span>;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await fetchMeetings();
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const isAdminOrHead = ['admin', 'head'].includes(String(user?.role).toLowerCase());

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const matchType = typeFilter === 'all' || String(m.meetingType).toLowerCase() === typeFilter;
      const matchQuery = !query || String(m.title).toLowerCase().includes(query.toLowerCase());
      return matchType && matchQuery;
    }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // newest first
  }, [meetings, typeFilter, query]);

  const upcomingMeeting = useMemo(() => {
    const now = new Date();
    // find nearest upcoming
    const upcomingList = filtered.filter(m => {
      const start = parseDate(m.startTime);
      const end = parseDate(m.endTime);
      return start > now || (start <= now && end >= now);
    }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return upcomingList[0];
  }, [filtered]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    setScheduleLoading(true);
    const formData = new FormData(e.target);
    const payload = {
      title: formData.get('title'),
      agenda: formData.get('agenda'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      meetingType: formData.get('meetingType'),
      details: {
        location: formData.get('location')
      }
    };
    
    try {
      await scheduleMeeting(payload);
      dispatchToast('Meeting scheduled successfully.', 'success');
      setIsScheduleModalOpen(false);
      load();
    } catch {
      dispatchToast('Failed to schedule meeting.', 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-0)] overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-white border border-slate-200 shadow-sm flex items-center justify-between bg-white border border-slate-200 shadow-sm">
        <PageHeader title="Virtual Headquarters" subtitle="Experience seamless meetings and collaboration." icon={Video} />
        {isAdminOrHead && (
          <button onClick={() => setIsScheduleModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 rounded-xl">
            <Plus size={18} /> Schedule Meeting
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* HERO SECTION FOR NEXT MEETING */}
        {upcomingMeeting && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-[2rem] overflow-hidden bg-white border border-slate-200 shadow-sm glow-blue p-8 pro-aurora"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    Up Next
                  </span>
                  <Countdown targetDate={parseDate(upcomingMeeting.startTime)} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-2">{upcomingMeeting.title}</h2>
                <p className="text-slate-600 max-w-xl">{upcomingMeeting.agenda || 'No agenda provided.'}</p>
                
                <div className="flex items-center gap-6 mt-6 text-sm font-medium text-slate-700">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-indigo-400" />
                    {formatDate(upcomingMeeting.startTime)} at {formatTime(upcomingMeeting.startTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    {upcomingMeeting.meetingType === 'Online' ? <Video size={16} className="text-indigo-400" /> : <MapPin size={16} className="text-indigo-400" />}
                    {upcomingMeeting.details?.location || 'TBA'}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col gap-3">
                <a href={upcomingMeeting.details?.location} target="_blank" rel="noreferrer" className="px-8 py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2">
                  <Play size={18} className="fill-black" /> Join Meeting
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-slate-200 shadow-sm p-4 rounded-2xl border border-slate-200">
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
            {TYPE_FILTERS.map(f => (
              <button 
                key={f.id} 
                onClick={() => setTypeFilter(f.id)}
                className={`px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${typeFilter === f.id ? 'bg-indigo-600 text-slate-900 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              value={query} onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search meetings..." 
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* LISTING */}
        {loading ? (
          <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600 font-medium">No meetings found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map((m, i) => {
                const state = getMeetingState(m);
                return (
                  <motion.div 
                    key={m._id}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white border border-slate-200 shadow-sm rounded-xl hover:border-indigo-500/50 hover:shadow-md shadow-blue-500/20 p-6 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                        state.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 border-blue-200' : 
                        state.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-200' : 
                        'bg-gray-800 text-slate-600 border-slate-300'
                      }`}>
                        {state.label}
                      </span>
                      <span className="text-slate-500 text-xs font-bold uppercase">{m.meetingType}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{m.title}</h3>
                    <p className="text-sm text-slate-600 mb-6 line-clamp-2">{m.agenda || 'No agenda provided.'}</p>
                    
                    <div className="space-y-2 mb-6 text-sm text-slate-600 font-medium">
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-indigo-400" /> {formatDate(m.startTime)}
                      </div>
                      <div className="flex items-center gap-3">
                        <CalendarClock size={16} className="text-indigo-400" /> {formatTime(m.startTime)} - {formatTime(m.endTime)}
                      </div>
                    </div>

                    <a href={m.details?.location} target="_blank" rel="noreferrer" className="w-full block text-center py-2.5 bg-slate-100 hover:bg-indigo-600 border border-indigo-500/20 hover:border-transparent text-indigo-300 hover:text-slate-900 rounded-xl text-sm font-bold transition-all">
                      View Details
                    </a>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleSchedule} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Title</label>
            <input name="title" required className="input-field" placeholder="Weekly Sync" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Agenda</label>
            <textarea name="agenda" required className="input-field min-h-24" placeholder="Discussion points..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Start Time</label>
              <input type="datetime-local" name="startTime" required className="input-field" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">End Time</label>
              <input type="datetime-local" name="endTime" required className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Type</label>
              <select name="meetingType" required className="input-field">
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Location / Link</label>
              <input name="location" required className="input-field" placeholder="Zoom link or Room C1" />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Cancel</button>
            <button type="submit" disabled={scheduleLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Schedule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
