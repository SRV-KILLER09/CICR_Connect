import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { Loader2, Mail, Calendar, CheckCircle2, XCircle, ArrowLeft, Star, Edit3 } from 'lucide-react';
import { fetchApplications, updateApplication, scheduleApplicationInterview, gradeApplicationInterview, finalizeApplication } from '../api';

const COLUMNS = [
  { id: 'New', title: 'New', color: 'bg-blue-100 text-blue-700' },
  { id: 'InReview', title: 'In Review', color: 'bg-purple-100 text-purple-700' },
  { id: 'Interview', title: 'Interview', color: 'bg-amber-100 text-amber-700' },
  { id: 'Selected', title: 'Selected', color: 'bg-green-100 text-green-700' },
  { id: 'Rejected', title: 'Rejected', color: 'bg-red-100 text-red-700' },
];

function DroppableColumn({ id, title, color, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex flex-col w-72 shrink-0 rounded-2xl bg-slate-50 border-2 ${isOver ? 'border-blue-400' : 'border-transparent'} transition-colors overflow-hidden h-[calc(100vh-280px)]`}>
      <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{React.Children.count(children)}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

function DraggableCard({ app, onClick }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: app._id, data: app });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(app)}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors"
    >
      <div className="font-bold text-slate-900">{app.fullName}</div>
      <div className="text-xs text-slate-500 mt-1 truncate">{app.email}</div>
      <div className="mt-3 flex gap-2">
        {app.year && <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">Yr {app.year}</span>}
        {app.interview?.date && <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-bold flex items-center gap-1"><Calendar size={10}/> Scheduled</span>}
        {app.interview?.marks != null && <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-[10px] font-bold flex items-center gap-1"><Star size={10}/> {app.interview.marks}</span>}
      </div>
    </div>
  );
}

export default function RecruitmentKanban({ drive, onBack }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [interviewModal, setInterviewModal] = useState(false);
  const [gradeModal, setGradeModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ date: '', location: '', link: '' });
  const [gradeForm, setGradeForm] = useState({ marks: '', note: '' });

  useEffect(() => {
    loadApps();
  }, [drive._id]);

  const loadApps = async () => {
    try {
      const { data } = await fetchApplications({ recruitmentDrive: drive._id });
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to load apps', type: 'error' } }));
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.data.current.status === over.id) return;
    
    if (active.data.current.status === 'Selected' || active.data.current.status === 'Rejected') {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Cannot revert a final decision.', type: 'error' } }));
      return;
    }

    const appId = active.id;
    const newStatus = over.id;
    
    // Optimistic UI update
    setApplications(apps => apps.map(a => a._id === appId ? { ...a, status: newStatus } : a));

    try {
      await updateApplication(appId, { status: newStatus });
      if (selectedApp?._id === appId) {
        setSelectedApp(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      loadApps(); // revert on fail
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      await scheduleApplicationInterview(selectedApp._id, interviewForm);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Interview scheduled & invite sent!', type: 'success' } }));
      setInterviewModal(false);
      loadApps();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to schedule', type: 'error' } }));
    }
  };

  const handleGrade = async (e) => {
    e.preventDefault();
    try {
      await gradeApplicationInterview(selectedApp._id, gradeForm);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Marks updated!', type: 'success' } }));
      setGradeModal(false);
      loadApps();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to grade', type: 'error' } }));
    }
  };

  const handleFinalize = async (action) => {
    if (!window.confirm(`Are you sure you want to ${action} ${selectedApp.fullName}? This will send an official email.`)) return;
    try {
      await finalizeApplication(selectedApp._id, action);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: `Candidate ${action}ed! Email sent.`, type: 'success' } }));
      loadApps();
      setSelectedApp(null);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Failed to process', type: 'error' } }));
    }
  };

  const filteredApps = applications.filter(app => 
    (app.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.phone || '').includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"><ArrowLeft size={16} /></button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{drive.title}</h2>
            <p className="text-sm text-slate-500">{applications.length} total candidates</p>
          </div>
        </div>
        <input 
          type="search"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-xl text-sm"
        />
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {COLUMNS.map(col => (
            <DroppableColumn key={col.id} id={col.id} title={col.title} color={col.color}>
              {filteredApps.filter(a => a.status === col.id).map(app => (
                <DraggableCard key={app._id} app={app} onClick={setSelectedApp} />
              ))}
            </DroppableColumn>
          ))}
        </DndContext>
      </div>

      {/* Candidate Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{selectedApp.fullName}</h3>
                <p className="text-slate-500">{selectedApp.email} • {selectedApp.phone}</p>
                <span className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-bold uppercase tracking-wide text-slate-700">{selectedApp.status}</span>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Dynamic Responses */}
              {selectedApp.dynamicResponses && Object.keys(selectedApp.dynamicResponses).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Application Responses</h4>
                  <div className="space-y-4">
                    {Object.entries(selectedApp.dynamicResponses).map(([q, a]) => (
                      <div key={q} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 mb-1">{q}</div>
                        <div className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Interview Details */}
              {selectedApp.interview?.date && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Interview Details</h4>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                    <p className="text-sm"><strong>Date:</strong> {new Date(selectedApp.interview.date).toLocaleString()}</p>
                    {selectedApp.interview.link && <p className="text-sm mt-1"><strong>Link:</strong> <a href={selectedApp.interview.link} className="text-blue-600 underline">{selectedApp.interview.link}</a></p>}
                    {selectedApp.interview.marks != null && <p className="text-sm mt-1 text-green-700"><strong>Marks Scored:</strong> {selectedApp.interview.marks}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-2 flex-wrap">
              <button onClick={() => setInterviewModal(true)} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center gap-2">
                <Calendar size={16} /> Schedule Interview
              </button>
              <button onClick={() => setGradeModal(true)} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center gap-2">
                <Edit3 size={16} /> Grade Candidate
              </button>
              <div className="flex-1"></div>
              {selectedApp.status === 'Selected' ? (
                <button onClick={() => handleFinalize('Accept')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-200 flex items-center gap-2">
                  <Mail size={16} /> Resend Invite Email
                </button>
              ) : selectedApp.status === 'Rejected' ? (
                <button onClick={() => handleFinalize('Reject')} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 flex items-center gap-2">
                  <Mail size={16} /> Resend Rejection
                </button>
              ) : (
                <>
                  <button onClick={() => handleFinalize('Reject')} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200">
                    Reject & Email
                  </button>
                  <button onClick={() => handleFinalize('Accept')} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Accept & Onboard
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals for Schedule and Grade */}
      {interviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSchedule} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100"><h3 className="text-lg font-bold">Schedule Interview</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Date & Time</label>
                <input required type="datetime-local" value={interviewForm.date} onChange={e => setInterviewForm({...interviewForm, date: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Meeting Link</label>
                <input type="url" value={interviewForm.link} onChange={e => setInterviewForm({...interviewForm, link: e.target.value})} placeholder="https://meet.google.com/..." className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setInterviewModal(false)} className="px-4 py-2 rounded-xl border font-semibold text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm">Send Invite Email</button>
            </div>
          </form>
        </div>
      )}

      {gradeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleGrade} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100"><h3 className="text-lg font-bold">Grade Candidate</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Marks (out of 100)</label>
                <input required type="number" min="0" max="100" value={gradeForm.marks} onChange={e => setGradeForm({...gradeForm, marks: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Interview Notes</label>
                <textarea rows="3" value={gradeForm.note} onChange={e => setGradeForm({...gradeForm, note: e.target.value})} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setGradeModal(false)} className="px-4 py-2 rounded-xl border font-semibold text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold text-sm">Save Marks</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
