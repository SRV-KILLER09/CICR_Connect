import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'issues', label: 'Issues' },
  { id: 'applications', label: 'Recruitment' },
  { id: 'events', label: 'Events' },
  { id: 'system', label: 'System' },
];

const categoryFromNotification = (item = {}) => {
  const title = String(item.title || '').toLowerCase();
  const message = String(item.message || '').toLowerCase();
  const link = String(item.link || '').toLowerCase();
  const hay = `${title} ${message} ${link}`;
  if (item.meta?.mention || hay.includes('mention') || hay.includes('@')) return 'mentions';
  if (hay.includes('approval') || hay.includes('pending admin')) return 'approvals';
  if (hay.includes('issue')) return 'issues';
  if (hay.includes('application') || hay.includes('recruitment')) return 'applications';
  if (hay.includes('event') || hay.includes('meeting')) return 'events';
  return 'system';
};

export default function NotificationCenter({
  open,
  onClose,
  items = [],
  loading = false,
  unreadCount = 0,
  onRefresh,
  onReadAll,
  onReadItem,
}) {
  const [filter, setFilter] = useState('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((item) => !item.isRead);
    return items.filter((item) => categoryFromNotification(item) === filter);
  }, [filter, items]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-50"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25 }}
            className="fixed right-0 top-0 h-full w-[min(480px,96vw)] z-[110] border-l border-slate-200 bg-[#090d13] shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Notification center"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-black">Notification Center</p>
                <h3 className="text-lg font-black text-slate-900 mt-0.5 inline-flex items-center gap-2">
                  <Bell size={15} className="text-cyan-600" />
                  Alerts and Updates
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-2.5 !py-1.5"
                aria-label="Close notification center"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-200 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-slate-700">
                <span className="ui-badge">{unreadCount} unread</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setFilter(row.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border ${
                      filter === row.id
                        ? 'border-blue-200 text-blue-700 bg-cyan-500/10'
                        : 'border-slate-300 text-slate-600 hover:text-slate-700'
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onReadAll} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5">
                  <CheckCheck size={12} />
                  Mark All Read
                </button>
                <button type="button" onClick={onRefresh} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5">
                  <RefreshCcw size={12} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Syncing notifications...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="ui-empty text-sm">No notifications in this view.</div>
              ) : (
                filteredItems.map((item) => {
                  const category = categoryFromNotification(item);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => onReadItem?.(item)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        item.isRead
                          ? 'border-slate-200 text-slate-600 hover:border-slate-300'
                          : 'border-blue-300 text-gray-100 bg-blue-500/5 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{item.title || 'Notification'}</p>
                          <p className="text-xs mt-1 text-slate-600 line-clamp-2">{item.message || ''}</p>
                        </div>
                        <ChevronRight size={14} className="mt-0.5 text-slate-500 shrink-0" />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                        <span>{category}</span>
                        <span>•</span>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</span>
                        {item.link ? (
                          <>
                            <span>•</span>
                            <span className="text-cyan-600">Open</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
