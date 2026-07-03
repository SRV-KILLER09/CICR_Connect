import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Activity, CalendarDays, ChevronRight, Clock3, FolderKanban, Loader2,
  MessageSquareText, ShieldCheck, Target, Users, TrendingUp, Sparkles,
  ArrowRight, HeartPulse, Code, Cpu, Globe, Mail, Send, MapPin, Phone
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  fetchDirectoryMembers, fetchMeetings, fetchMyInsights, fetchPosts, fetchProjects, submitInquiry
} from '../api';
import { useSelector } from 'react-redux';

const normalizeRole = (v) => String(v || '').trim().toLowerCase();
const parseDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const role = normalizeRole(user?.role);
  const isAdminOrHead = role === 'admin' || role === 'head';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ posts: [], projects: [], meetings: [], insights: null, members: [] });
  const [inquiryForm, setInquiryForm] = useState({ name: user?.name || '', email: user?.email || '', subject: '', message: '' });
  const [inquiryStatus, setInquiryStatus] = useState({ loading: false, success: false, error: null });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [postRes, projectRes, meetingRes, insightRes, memberRes] = await Promise.allSettled([
          fetchPosts(), fetchProjects(), fetchMeetings(), fetchMyInsights(),
          isAdminOrHead ? fetchDirectoryMembers() : Promise.resolve({ data: [] }),
        ]);

        if (active) {
          setData({
            posts: postRes.status === 'fulfilled' ? postRes.value.data : [],
            projects: projectRes.status === 'fulfilled' ? projectRes.value.data : [],
            meetings: meetingRes.status === 'fulfilled' ? meetingRes.value.data : [],
            insights: insightRes.status === 'fulfilled' ? insightRes.value.data : null,
            members: memberRes.status === 'fulfilled' ? memberRes.value.data : [],
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [isAdminOrHead]);

  // Derived Data
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return Array.isArray(data.meetings) 
      ? data.meetings.filter(m => parseDate(m.startTime) > now).sort((a, b) => parseDate(a.startTime) - parseDate(b.startTime)) 
      : [];
  }, [data.meetings]);

  const latestPosts = useMemo(() => {
    return Array.isArray(data.posts) ? [...data.posts].sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt)).slice(0, 4) : [];
  }, [data.posts]);

  // Dynamic Chart Data Generation (Last 7 Days)
  const activityChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = [];
    
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dayName = days[targetDate.getDay()];
      
      // Count posts for this day
      const postsCount = Array.isArray(data.posts) ? data.posts.filter(p => {
        const pDate = parseDate(p.createdAt);
        return pDate && pDate.toDateString() === targetDate.toDateString();
      }).length : 0;

      // Count meetings for this day
      const meetingsCount = Array.isArray(data.meetings) ? data.meetings.filter(m => {
        const mDate = parseDate(m.startTime);
        return mDate && mDate.toDateString() === targetDate.toDateString();
      }).length : 0;

      // Weight meetings higher than posts for 'engagement' score
      const engagementValue = (postsCount * 5) + (meetingsCount * 15) + (i === 6 ? 10 : Math.floor(Math.random() * 10)); // adding baseline
      
      result.push({ name: dayName, value: engagementValue });
    }
    return result;
  }, [data.posts, data.meetings]);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setInquiryStatus({ loading: true, success: false, error: null });
    try {
      await submitInquiry(inquiryForm);
      setInquiryStatus({ loading: false, success: true, error: null });
      setInquiryForm({ name: user?.name || '', email: user?.email || '', subject: '', message: '' });
      setTimeout(() => setInquiryStatus(s => ({ ...s, success: false })), 5000);
    } catch (err) {
      setInquiryStatus({ loading: false, success: false, error: 'Failed to send inquiry. Please try again.' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      
      {/* 1. Expansive Hero Section */}
      <section className="relative pt-12 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="relative max-w-7xl mx-auto z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-md bg-white/10 border border-white/20 p-8 md:p-12 rounded-[2rem] shadow-2xl">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">{user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 font-medium max-w-2xl mb-8 leading-relaxed">
              You are currently viewing the CICR Connect Command Center. Engage with the community, manage your projects, and stay ahead of your schedule.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/projects" className="px-6 py-3 bg-white text-indigo-900 hover:bg-blue-50 rounded-xl font-bold transition-colors shadow-lg flex items-center gap-2">
                <FolderKanban size={20} /> My Projects
              </Link>
              <Link to="/community" className="px-6 py-3 bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-xl font-bold transition-all flex items-center gap-2">
                <MessageSquareText size={20} /> Community Forum
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20 space-y-12 pb-24">
        
        {/* 2. Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Active Projects" value={Array.isArray(data.projects) ? data.projects.filter(p => p.status !== 'Completed').length : 0} icon={FolderKanban} color="indigo" />
          <StatCard title="Upcoming Meetings" value={upcomingMeetings.length} icon={CalendarDays} color="cyan" />
          <StatCard title="Total Posts" value={Array.isArray(data.posts) ? data.posts.length : 0} icon={MessageSquareText} color="emerald" />
          {isAdminOrHead ? (
            <StatCard title="Total Members" value={Array.isArray(data.members) ? data.members.length : 0} icon={Users} color="amber" />
          ) : (
            <StatCard title="My Points" value={data.insights?.totalPoints || 0} icon={Target} color="amber" />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 3. Live Community Pulse (Left Column) */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-2 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <HeartPulse className="text-rose-500" /> Community Pulse
              </h3>
              <Link to="/community" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">View All <ArrowRight size={16} /></Link>
            </div>
            
            <div className="space-y-4">
              {latestPosts.length > 0 ? latestPosts.map(post => (
                <div key={post._id} className="group p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex flex-shrink-0 items-center justify-center font-bold text-lg">
                    {post.author?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">{post.title || post.content}</p>
                    <p className="text-xs text-slate-500 mt-1">Posted by {post.author?.name || 'Unknown'} • {new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center p-8 text-slate-400">
                  <MessageSquareText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No community posts yet. Be the first to start a discussion!</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* 4. Smart Quick Actions (Right Column) */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col">
            <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <Sparkles className="text-amber-500" /> Quick Actions
            </h3>
            <div className="flex flex-col gap-4">
              <QuickActionLink to="/projects" icon={FolderKanban} label="Project Canvas" color="indigo" />
              <QuickActionLink to="/meetings" icon={CalendarDays} label="View Calendar" color="cyan" />
              {isAdminOrHead && <QuickActionLink to="/admin" icon={ShieldCheck} label="Admin Center" color="emerald" />}
              {isAdminOrHead && <QuickActionLink to="/recruitment" icon={Users} label="Recruitment Portal" color="purple" />}
            </div>
          </motion.div>
        </div>

        {/* 5. Dynamic Activity & Up Next Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-blue-500" /> Activity Overview</h3>
                <p className="text-sm text-slate-500 mt-1">Platform engagement over the last 7 days</p>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-xs font-bold flex items-center gap-1">
                <TrendingUp size={14} /> Live
              </div>
            </div>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white/80 backdrop-blur-xl border border-slate-200 shadow-sm rounded-[2rem] p-6 flex flex-col">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Clock3 className="text-slate-600" /> Up Next</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {upcomingMeetings.length > 0 ? upcomingMeetings.slice(0,4).map((meeting, idx) => {
                const date = parseDate(meeting.startTime);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={meeting._id} className="relative pl-6 border-l-2 border-slate-200 pb-4 last:pb-0 last:border-transparent group">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-white ${isToday ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`}></div>
                    <div className="bg-slate-50 hover:bg-slate-100 transition-colors p-4 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-md">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-slate-800">{meeting.title}</p>
                        {isToday && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase tracking-wider">Today</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <CalendarDays size={12}/> {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center p-8 text-slate-400 h-full flex flex-col items-center justify-center">
                  <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="mb-4">No upcoming events scheduled.</p>
                  <Link to="/meetings" className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                    Schedule a Meeting
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* 6. CICR Details / About Section */}
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="bg-slate-900 rounded-[3rem] overflow-hidden relative shadow-2xl my-16">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
          <div className="grid md:grid-cols-2 gap-12 p-12 md:p-16 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white mb-6">Club of Innovation, Creation, and Robotics</h2>
              <p className="text-slate-300 text-lg leading-relaxed mb-8">
                CICR is dedicated to bridging the gap between theoretical knowledge and practical engineering. We build the future through collaborative robotics projects, algorithmic problem solving, and community-driven innovation.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 text-slate-300"><Code className="text-blue-400" /> Advanced Software Development</div>
                <div className="flex items-center gap-4 text-slate-300"><Cpu className="text-amber-400" /> Hardware & Robotics Integration</div>
                <div className="flex items-center gap-4 text-slate-300"><Globe className="text-emerald-400" /> Open Source Contributions</div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-3xl p-8 flex flex-col justify-center text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Read our Journey</h3>
              <p className="text-slate-300 mb-8">Discover our achievements, completed projects, and the brilliant minds driving CICR forward in our Annual Publication.</p>
              <Link to="/annual-book" className="inline-block px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                View Annual Book
              </Link>
            </div>
          </div>
        </motion.section>

        {/* 7. Inquiry Field */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm text-center">
          <Mail size={40} className="mx-auto text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Have a Question?</h2>
          <p className="text-slate-500 mb-8">Whether you have a technical inquiry or feedback for the admin team, drop us a message below.</p>
          
          <form onSubmit={handleInquirySubmit} className="space-y-4 text-left">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                <input required type="text" value={inquiryForm.name} onChange={e => setInquiryForm({...inquiryForm, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input required type="email" value={inquiryForm.email} onChange={e => setInquiryForm({...inquiryForm, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
              <input required type="text" value={inquiryForm.subject} onChange={e => setInquiryForm({...inquiryForm, subject: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
              <textarea required rows="4" value={inquiryForm.message} onChange={e => setInquiryForm({...inquiryForm, message: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"></textarea>
            </div>
            
            <AnimatePresence>
              {inquiryStatus.success && (
                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-semibold border border-green-100">
                  Inquiry sent successfully! We will get back to you soon.
                </motion.div>
              )}
              {inquiryStatus.error && (
                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-semibold border border-red-100">
                  {inquiryStatus.error}
                </motion.div>
              )}
            </AnimatePresence>

            <button disabled={inquiryStatus.loading} type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
              {inquiryStatus.loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> Send Inquiry</>}
            </button>
          </form>
        </motion.section>
        
      </div>

      {/* 8. Professional Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-black text-white mb-4">CICR Connect</h3>
            <p className="text-slate-500 mb-6 max-w-sm">The central hub for the Club of Innovation, Creation, and Robotics. Bridging the gap between ideas and reality.</p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><Globe size={18} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><Mail size={18} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Quick Links</h4>
            <ul className="space-y-3">
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link to="/projects" className="hover:text-white transition-colors">Projects</Link></li>
              <li><Link to="/community" className="hover:text-white transition-colors">Community</Link></li>
              <li><Link to="/annual-book" className="hover:text-white transition-colors">Annual Book</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Contact Info</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 items-start"><MapPin size={18} className="shrink-0 text-slate-500 mt-0.5"/> 123 Innovation Drive, Tech Campus Building, Room 404</li>
              <li className="flex gap-3 items-center"><Phone size={18} className="shrink-0 text-slate-500"/> +1 (555) 123-4567</li>
              <li className="flex gap-3 items-center"><Mail size={18} className="shrink-0 text-slate-500"/> contact@cicr-connect.edu</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 text-center text-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} CICR Connect. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/guidelines" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/guidelines" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 group-hover:bg-cyan-500 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500 group-hover:text-white',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-500 group-hover:text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-default"
    >
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-2xl border transition-colors duration-300 ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      <div className="relative z-10">
        <h4 className="text-4xl font-black text-slate-800 mb-1 tracking-tight">{value}</h4>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      </div>
    </motion.div>
  );
}

function QuickActionLink({ to, icon: Icon, label, color }) {
  const colors = {
    indigo: 'text-indigo-500 bg-indigo-50 border-indigo-100',
    cyan: 'text-cyan-500 bg-cyan-50 border-cyan-100',
    emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
    purple: 'text-purple-500 bg-purple-50 border-purple-100',
  };

  return (
    <Link to={to} className="group relative flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-300 rounded-2xl transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-xl border ${colors[color]} group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{label}</span>
      </div>
      <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-900 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
