import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, LayoutList, Calendar, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { fetchRecruitmentDrives, createRecruitmentDrive, updateRecruitmentDrive } from '../api';
import RecruitmentKanban from '../components/RecruitmentKanban';
import RecruitmentFormBuilder from '../components/RecruitmentFormBuilder';

export default function RecruitmentAdmin() {
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list', 'builder', 'kanban'
  const [activeDrive, setActiveDrive] = useState(null);

  useEffect(() => {
    loadDrives();
  }, []);

  const loadDrives = async () => {
    try {
      setLoading(true);
      const res = await fetchRecruitmentDrives();
      setDrives(res.data?.data || []);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to load drives', type: 'error' } }));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDrive = async (driveData) => {
    try {
      await createRecruitmentDrive(driveData);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Drive created successfully!', type: 'success' } }));
      setView('list');
      loadDrives();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to create drive', type: 'error' } }));
    }
  };

  const toggleDriveStatus = async (drive) => {
    try {
      await updateRecruitmentDrive(drive._id, { isOpen: !drive.isOpen });
      loadDrives();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to update status', type: 'error' } }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8">
      <PageHeader
        eyebrow="Recruitment"
        title="Recruitment Management"
        subtitle="Manage recruitment drives, dynamic application forms, and track candidates."
        icon={Users}
        actions={
          view === 'list' ? (
            <button
              onClick={() => setView('builder')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors"
            >
              <Plus size={16} />
              New Drive
            </button>
          ) : (
            <button
              onClick={() => setView('list')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl shadow-sm text-sm font-semibold transition-colors"
            >
              <LayoutList size={16} />
              Back to Drives
            </button>
          )
        }
      />

      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="text-slate-500">Loading drives...</p>
          ) : drives.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-800">No Recruitment Drives</h3>
              <p className="text-slate-500 mt-1 mb-6">Create your first recruitment drive to start accepting applications.</p>
              <button onClick={() => setView('builder')} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold shadow-sm text-sm">
                Create Drive
              </button>
            </div>
          ) : (
            drives.map(drive => (
              <div key={drive._id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{drive.title}</h3>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${drive.isOpen ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {drive.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{drive.description}</p>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-slate-50 p-2 rounded-lg">
                  <Calendar size={14} />
                  Deadline: {new Date(drive.deadline).toLocaleDateString()}
                </div>

                <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => { setActiveDrive(drive); setView('kanban'); }}
                    className="flex-1 px-3 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    View Candidates
                  </button>
                  <button 
                    onClick={() => toggleDriveStatus(drive)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    {drive.isOpen ? 'Close' : 'Open'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {view === 'builder' && (
        <RecruitmentFormBuilder onSave={handleCreateDrive} onCancel={() => setView('list')} />
      )}

      {view === 'kanban' && activeDrive && (
        <RecruitmentKanban drive={activeDrive} onBack={() => setView('list')} />
      )}
    </div>
  );
}
