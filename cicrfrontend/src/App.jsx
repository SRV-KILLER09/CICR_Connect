import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import GlobalToastHost from '@/components/GlobalToastHost';
import { Loader2 } from 'lucide-react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from '@/store';
import { loadUser } from '@/store/authSlice';

const Auth = lazy(() => import('@/pages/Auth'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Projects = lazy(() => import('@/pages/Projects'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const Hierarchy = lazy(() => import('@/pages/Hierarchy'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
const RecruitmentAdmin = lazy(() => import('@/pages/RecruitmentAdmin'));
const Community = lazy(() => import('@/pages/Community'));
const Profile = lazy(() => import('@/pages/Profile'));
const PublicProfile = lazy(() => import('@/pages/PublicProfile'));
const LearningHub = lazy(() => import('@/pages/LearningHub'));
const ProgramsHub = lazy(() => import('@/pages/ProgramsHub'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const Guidelines = lazy(() => import('@/pages/Guidelines'));
const Communication = lazy(() => import('@/pages/Communication'));
const Events = lazy(() => import('@/pages/Events'));
const EventDetails = lazy(() => import('@/pages/EventDetails'));
const Apply = lazy(() => import('@/pages/Apply'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const AnnualBook = lazy(() => import('@/pages/AnnualBook'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cyan-400 font-bold">
          Loading CICR Connect...
        </div>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useSelector((state) => state.auth);
  
  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

const RoleRoute = ({ roles, children }) => {
  const { user, loading } = useSelector((state) => state.auth);

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (roles && !roles.map(r => r.toLowerCase()).includes(String(user?.role).toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/auth/magic-link" element={<Auth />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/profile/:collegeId" element={<PublicProfile />} />
        <Route path="/apply" element={<Apply />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />

          {/* Consolidated Modules */}
          <Route path="/projects" element={<Projects />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/inventory" element={<Inventory />} />

          <Route path="/hierarchy" element={<Hierarchy />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />

          <Route path="/community" element={<Community />} />
          <Route path="/learning" element={<LearningHub />} />
          <Route path="/programs" element={<ProgramsHub />} />
          <Route path="/annual-book" element={<AnnualBook />} />
          <Route path="/ai" element={<Navigate to="/communication" replace />} />
          
          <Route
            path="/communication"
            element={
              <RoleRoute roles={['admin']}>
                <Communication />
              </RoleRoute>
            }
          />
          <Route path="/guidelines" element={<Guidelines />} />

          <Route
            path="/admin"
            element={
              <RoleRoute roles={['admin', 'head']}>
                <AdminPanel />
              </RoleRoute>
            }
          />
          <Route
            path="/recruitment"
            element={
              <RoleRoute roles={['admin', 'head']}>
                <RecruitmentAdmin />
              </RoleRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppInitializer({ children }) {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);
  return children;
}

function App() {
  return (
    <Provider store={store}>
      <AppInitializer>
        <Router>
          <GlobalToastHost />
          <AppRoutes />
        </Router>
      </AppInitializer>
    </Provider>
  );
}

export default App;
