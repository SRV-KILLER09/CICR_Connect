import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, User, CalendarDays, Loader2, ArrowRight } from 'lucide-react';
import { globalSearch } from '../api';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ users: [], events: [] });
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ users: [], events: [] });
      return;
    }
    // Auto focus can be handled via ref, but simplified here
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ users: [], events: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(query);
        if (res.data?.success) {
          setResults(res.data.results);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce to save server costs

    return () => clearTimeout(timer);
  }, [query]);

  const handleAction = (type, id) => {
    onClose();
    if (type === 'user') navigate(`/profile/${id}`); // Assuming a public profile route exists, or admin view
    if (type === 'event') navigate(`/events`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 top-[10%] mx-auto w-[min(90vw,600px)] bg-white rounded-2xl shadow-2xl z-[110] overflow-hidden border border-slate-200"
          >
            <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
              <Search className="text-blue-500 mr-3 shrink-0" size={24} />
              <input
                autoFocus
                type="text"
                placeholder="Search users or events..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 placeholder-slate-400"
              />
              {loading && <Loader2 className="animate-spin text-slate-400 shrink-0" size={20} />}
              <div className="ml-3 px-2 py-1 bg-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-widest">Esc</div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
              {query.trim().length > 0 && query.trim().length < 2 && (
                <div className="p-4 text-center text-sm text-slate-500">Keep typing to search...</div>
              )}
              
              {!loading && query.trim().length >= 2 && results.users.length === 0 && results.events.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Search size={32} className="mx-auto mb-3 opacity-20" />
                  <p>No users or events found for "{query}"</p>
                </div>
              )}

              {results.users.length > 0 && (
                <div className="mb-4">
                  <h3 className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">Users</h3>
                  {results.users.map(u => (
                    <button
                      key={u._id}
                      onClick={() => handleAction('user', u._id)}
                      className="w-full text-left flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover"/> : <User size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{u.name}</p>
                          <p className="text-xs text-slate-500 capitalize">{u.role}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-500 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              )}

              {results.events.length > 0 && (
                <div>
                  <h3 className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">Events</h3>
                  {results.events.map(e => (
                    <button
                      key={e._id}
                      onClick={() => handleAction('event', e._id)}
                      className="w-full text-left flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CalendarDays size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{e.title}</p>
                          <p className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
