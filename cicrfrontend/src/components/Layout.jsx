import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, FolderKanban, 
  Calendar, ShieldCheck, FileText, UserSquare2,
  Package, Menu, X, Radio, Sparkles, Bell, GitBranchPlus, Search, 
  BookOpenCheck, PanelsTopLeft, BookOpen, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import logo from './logo.png';
import GlobalSearch from './GlobalSearch';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../store/authSlice';
import NotificationCenter from './NotificationCenter';
import GlowingChatbot from './GlowingChatbot';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  
  const isStrictAdmin = user?.role?.toLowerCase() === 'admin';
  const isAdminOrHead = ['admin', 'head'].includes(user?.role?.toLowerCase());

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const { data } = await fetchNotifications({ limit: 50 });
      // Depending on API response structure:
      const items = Array.isArray(data) ? data : (data?.items || []);
      const count = data?.unreadCount ?? items.filter(n => !n.isRead).length;
      
      setNotifications(items);
      setUnreadCount(Number(count));
    } catch (e) {
      console.error(e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const handleReadItem = async (item) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item._id);
        setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const poll = setInterval(loadNotifications, 30000);
    return () => clearInterval(poll);
  }, [loadNotifications]);

  useEffect(() => {
    setNotificationsOpen(false);
    setIsSearchOpen(false);
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Global Keyboard Shortcut for Search (CMD+K / CTRL+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navGroups = useMemo(() => [
    {
      id: 'core',
      label: 'Core Workspace',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: FolderKanban, label: 'Projects', path: '/projects' },
        { icon: Calendar, label: 'Meetings', path: '/meetings' },
        { icon: Sparkles, label: 'Events', path: '/events' },
        { icon: Package, label: 'Inventory', path: '/inventory' },
      ],
    },
    {
      id: 'growth',
      label: 'Growth & Community',
      items: [
        { icon: GitBranchPlus, label: 'Mentorship Ops', path: '/hierarchy' },
        { icon: BookOpenCheck, label: 'Learning Hub', path: '/learning' },
        { icon: PanelsTopLeft, label: 'Programs Hub', path: '/programs' },
        { icon: Users, label: 'Community', path: '/community' },
        { icon: BookOpen, label: 'Annual Book', path: '/annual-book' },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        ...(isStrictAdmin ? [{ icon: Radio, label: 'Collab Stream', path: '/communication' }] : []),
        ...(isAdminOrHead ? [
          { icon: ShieldCheck, label: 'Admin Panel', path: '/admin' },
          { icon: Users, label: 'Recruitment Ops', path: '/recruitment' }
        ] : []),
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { icon: UserSquare2, label: 'Profile', path: '/profile' },
        { icon: FileText, label: 'Guidelines', path: '/guidelines' },
      ],
    },
  ], [isAdminOrHead, isStrictAdmin]);

  const sidebarWidth = isCollapsed ? 80 : 288; // w-20 = 80px, w-72 = 288px

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-ui relative w-full overflow-hidden">
      
      {/* Desktop Sidebar (Animated & Dark) */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarWidth }}
        className="hidden lg:flex flex-col fixed inset-y-0 z-40 bg-slate-950 border-r border-slate-900 shadow-2xl overflow-hidden"
      >
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
          <Link to="/dashboard" className="flex items-center gap-3 group shrink-0">
            <img src={logo} alt="CICR logo" className="h-8 w-auto" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }} 
                  animate={{ opacity: 1, width: 'auto' }} 
                  exit={{ opacity: 0, width: 0 }} 
                  className="font-brand font-extrabold text-xl text-white whitespace-nowrap overflow-hidden"
                >
                  CICR Connect
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-6 scrollbar-hide pb-6 mt-4">
          {navGroups.map(group => (
            <div key={group.id} className="w-full">
              {!isCollapsed ? (
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-3 whitespace-nowrap">
                  {group.label}
                </h3>
              ) : (
                <div className="h-px bg-slate-800 w-8 mx-auto mb-4" />
              )}
              
              <div className="space-y-1">
                {group.items.map(link => {
                  const isActive = location.pathname.startsWith(link.path);
                  return (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      title={isCollapsed ? link.label : ''} // Native tooltip when collapsed
                      className={`relative flex items-center gap-3 rounded-xl transition-all duration-300 group overflow-hidden ${
                        isCollapsed ? 'justify-center p-3 mx-1' : 'px-3 py-3'
                      } ${
                        isActive 
                          ? 'bg-blue-600/10 text-blue-400' 
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="activeNav"
                          className="absolute inset-0 bg-blue-600/10 rounded-xl"
                          initial={false}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {isActive && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />
                      )}
                      
                      <link.icon size={20} className={`shrink-0 relative z-10 transition-transform duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'group-hover:scale-110'}`} />
                      
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.span 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
                            className={`text-sm font-semibold whitespace-nowrap relative z-10 ${isActive ? 'text-blue-400' : ''}`}
                          >
                            {link.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto border-t border-slate-900 bg-slate-950 p-4">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-white transition-colors mb-4`}
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <div className="flex items-center gap-2"><PanelLeftClose size={20} /><span className="text-sm font-semibold">Collapse</span></div>}
          </button>
          
          <Link to="/profile" className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-900 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-slate-950">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-black text-sm text-white shadow-sm">{user?.name?.[0] || 'U'}</span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.name || 'Member'}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold truncate">{user?.role || 'Member'}</p>
              </div>
            )}
          </Link>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <motion.main 
        initial={false}
        animate={{ marginLeft: isCollapsed ? 80 : 288 }}
        className="flex-1 flex flex-col min-h-screen relative z-10 w-full overflow-x-hidden lg:ml-72" // Default lg:ml-72 for initial load before hydration
      >
        <header className="h-16 flex items-center justify-between lg:justify-end px-4 lg:px-8 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="lg:hidden flex items-center gap-3">
            <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
              <Menu size={24} />
            </button>
            <span className="font-brand font-extrabold text-lg text-slate-800">CICR Connect</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            
            {/* Global Search Button */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200"
            >
              <Search size={18} />
              <span className="text-sm font-semibold hidden md:inline">Search...</span>
              <kbd className="hidden lg:inline-flex items-center justify-center px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-500">⌘ K</kbd>
            </button>

            {/* Notification Bell */}
            <button 
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 w-full max-w-[100vw]">
          <Outlet />
        </div>
      </motion.main>

      {/* Mobile Sidebar Overlay (Kept mostly Light for mobile familiarity, or can match Dark) */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-900 shadow-xl z-50 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-900">
                <span className="font-brand font-extrabold text-xl text-white">CICR Connect</span>
                <button onClick={() => setIsMobileOpen(false)} className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {navGroups.map(group => (
                  <div key={group.id}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-3">{group.label}</h3>
                    <div className="space-y-1">
                      {group.items.map(link => (
                        <NavLink
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsMobileOpen(false)}
                          className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                            isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'text-slate-400 font-medium hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <link.icon size={18} className={({ isActive }) => isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-slate-400'} />
                          <span className="text-sm">{link.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <GlobalSearch open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      
      <NotificationCenter 
        open={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        items={notifications}
        loading={notifLoading}
        unreadCount={unreadCount}
        onRefresh={loadNotifications}
        onReadAll={handleReadAll}
        onReadItem={handleReadItem}
      />
      
      <GlowingChatbot />
    </div>
  );
}
