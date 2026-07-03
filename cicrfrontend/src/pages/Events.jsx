import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock4,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { createEvent, deleteEvent, fetchEvents, updateEvent } from '../api';
import PageHeader from '../components/PageHeader';
import SideDrawer from '../components/ui/SideDrawer';

const EVENT_TYPES = ['Orientation', 'Workshop', 'Recruitment', 'Competition', 'Seminar', 'Internal'];
const EVENT_STATUS_FILTERS = ['All', 'Scheduled', 'Completed', 'Cancelled'];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const fmtDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString();
};

const fmtTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '', type: 'Workshop', location: '', startTime: '', endTime: '', description: '', allowApplications: false, applicationDeadline: ''
  });

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data } = await fetchEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      dispatchToast('Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const eventCounts = useMemo(() => {
    const counts = { all: events.length, scheduled: 0, completed: 0, cancelled: 0 };
    events.forEach((event) => {
      const normalized = String(event.status || '').toLowerCase();
      if (normalized === 'scheduled') counts.scheduled += 1;
      if (normalized === 'completed') counts.completed += 1;
      if (normalized === 'cancelled') counts.cancelled += 1;
    });
    return counts;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
    return events.filter((event) => {
      const statusMatch = statusFilter === 'All' ? true : String(event.status || '') === statusFilter;
      const queryMatch = normalizedQuery
        ? `${event.title || ''} ${event.type || ''} ${event.location || ''}`.toLowerCase().includes(normalizedQuery)
        : true;
      return statusMatch && queryMatch;
    }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }, [events, searchQuery, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const payload = {
        ...formData,
        applicationDeadline: formData.applicationDeadline || null,
        allowApplications: !!formData.allowApplications,
        projects: [] // simplified for UI redesign
      };

      await createEvent(payload);
      dispatchToast('Event created successfully.', 'success');
      setIsDrawerOpen(false);
      loadEvents();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create event.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusUpdate = async (eventId, status) => {
    try {
      await updateEvent(eventId, { status });
      dispatchToast(`Event marked ${status}.`, 'success');
      loadEvents();
    } catch (err) {
      dispatchToast('Failed to update event.', 'error');
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteEvent(eventId);
      dispatchToast('Event removed.', 'success');
      loadEvents();
    } catch (err) {
      dispatchToast('Failed to delete event.', 'error');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 space-y-8 px-4 sm:px-6 lg:px-8 pb-20 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-purple/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3 z-0" />
      
      <header className="relative z-10 pt-4">
        <PageHeader
          eyebrow="CICR Events"
          title="Events Dashboard"
          subtitle="Manage all upcoming and past events."
          icon={CalendarDays}
          badge={<><Sparkles size={13} className="text-accent-purple" /> {eventCounts.scheduled} active events</>}
          actions={isAdmin && (
            <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">
              <Plus size={16} /> New Event
            </button>
          )}
        />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        <Metric label="Total Events" value={eventCounts.all} tone="slate" />
        <Metric label="Scheduled" value={eventCounts.scheduled} tone="cyan" />
        <Metric label="Completed" value={eventCounts.completed} tone="emerald" />
        <Metric label="Cancelled" value={eventCounts.cancelled} tone="rose" />
      </section>

      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 rounded-2xl sticky top-20 z-20 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, locations..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {EVENT_STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`btn !w-auto !px-4 !py-2 ${statusFilter === filter ? 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2' : 'px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10">
        {loading ? (
          <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-blue" /></div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 text-slate-600 font-medium">No events found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredEvents.map((event, idx) => (
                <EventCard 
                  key={event._id} 
                  event={event} 
                  idx={idx} 
                  isAdmin={isAdmin} 
                  onUpdateStatus={handleStatusUpdate} 
                  onDelete={handleDelete}
                  navigate={navigate}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Create Event">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Title</label>
            <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="input-field" placeholder="E.g., Hackathon 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="input-field">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Location</label>
              <input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required className="input-field" placeholder="Room or URL" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Start Time</label>
              <input type="datetime-local" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} required className="input-field" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">End Time</label>
              <input type="datetime-local" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} required className="input-field" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1 block">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input-field min-h-24" placeholder="Event details..." />
          </div>
          
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 mt-8">
            <button type="button" onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Cancel</button>
            <button type="submit" disabled={isCreating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">Create Event</button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}

function EventCard({ event, idx, isAdmin, onUpdateStatus, onDelete, navigate }) {
  const [expanded, setExpanded] = useState(false);
  
  const statusColors = {
    'Scheduled': 'text-cyan-400 border-blue-200 bg-cyan-400/10',
    'Completed': 'text-emerald-400 border-emerald-200 bg-emerald-400/10',
    'Cancelled': 'text-rose-400 border-red-200 bg-rose-400/10',
  };
  const color = statusColors[event.status] || 'text-slate-600 border-slate-600 bg-slate-800';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
      className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
            <div className="flex gap-2 items-center flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${color}`}>
                {event.status}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                {event.type}
              </span>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-600 hover:text-slate-900 p-1">
            {expanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
          </button>
        </div>

        <p className="text-sm text-slate-600 line-clamp-2 mb-6">{event.description || 'No description available.'}</p>

        <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-700">
          <div className="flex items-center gap-2"><CalendarDays size={16} className="text-blue-600" /> {fmtDate(event.startTime)}</div>
          <div className="flex items-center gap-2"><Clock4 size={16} className="text-accent-purple" /> {fmtTime(event.startTime)} - {fmtTime(event.endTime)}</div>
          <div className="flex items-center gap-2"><MapPin size={16} className="text-emerald-600" /> {event.location}</div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-6 mt-6 border-t border-slate-200">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate(`/events/${event._id}`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 flex-1">
                  View Details <ArrowRight size={16}/>
                </button>
                {isAdmin && (
                  <>
                    {event.status === 'Scheduled' && (
                      <button onClick={() => onUpdateStatus(event._id, 'Completed')} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-emerald-600 hover:!bg-accent-emerald/20">
                        <CheckCircle2 size={16}/> Complete
                      </button>
                    )}
                    {event.status !== 'Cancelled' && (
                      <button onClick={() => onUpdateStatus(event._id, 'Cancelled')} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-rose-400 hover:!bg-rose-400/20">
                        Cancel
                      </button>
                    )}
                    <button onClick={() => onDelete(event._id)} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-slate-600 hover:!text-slate-900">
                      <Trash2 size={16}/>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function Metric({ label, value, tone = 'slate' }) {
  const toneClass = tone === 'cyan' ? 'text-cyan-400 border-blue-200' : 
                    tone === 'emerald' ? 'text-emerald-400 border-emerald-200' : 
                    tone === 'rose' ? 'text-rose-400 border-red-200' : 
                    'text-slate-900 border-slate-200';
  
  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-2xl p-5 rounded-2xl border-t-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-600">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}
