import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  fetchMembers,
  updateUserByAdmin,
  deleteUser,
  sendBulkEmail,
  generateInvite,
  sendInviteEmail,
  fetchPendingAdminActions,
  approveAdminAction,
  fetchTemporaryAccessUsers,
  grantTemporaryAccess,
  revokeTemporaryAccess,
  fetchApplications,
  updateApplication,
  sendApplicationInvite,
  generatePasswordResetCode,
  fetchAuditLogs,
  broadcastNotification,
} from '../api';
import CicrAssistant from '../components/CicrAssistant';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataLoading } from '../components/DataState';
import { 
  Shield, Trash2, UserPlus, Copy, Check, 
  Search, Mail, Send, Loader2, UserCheck, GraduationCap, Fingerprint,
  ClipboardCheck, Crown, KeyRound, Megaphone, ScrollText, Download, ArrowUpDown,
  UserCog, GripVertical, ShieldAlert, Sparkles, X, ChevronDown
} from 'lucide-react';

const APPLICATION_STATUSES = ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'];
const USER_TABLE_COLUMNS = [
  { id: 'member', label: 'Member' },
  { id: 'role', label: 'Role' },
  { id: 'year', label: 'Year' },
  { id: 'approval', label: 'Approval' },
  { id: 'actions', label: 'Actions' },
];
const DEFAULT_VISIBLE_COLUMNS = USER_TABLE_COLUMNS.map((column) => column.id);
const RECRUITMENT_LANES = [
  { id: 'Applied', label: 'Applied', status: 'New', stage: 'Applied' },
  { id: 'Shortlisted', label: 'Shortlisted', status: 'InReview', stage: 'Shortlisted' },
  { id: 'Interview', label: 'Interview', status: 'Interview', stage: 'Interview' },
  { id: 'Selected', label: 'Selected', status: 'Selected', stage: 'Selected' },
  { id: 'Joined', label: 'Joined', status: 'Selected', stage: 'Joined' },
];
const FILTER_PRESET_KEY = 'admin_user_saved_views';

const normalizeAppStage = (app = {}) => {
  const stage = String(app.stage || '').trim().toLowerCase();
  const status = String(app.status || '').trim().toLowerCase();
  if (stage === 'joined') return 'Joined';
  if (status === 'selected' && stage === 'joined') return 'Joined';
  if (status === 'accepted') return 'Selected';
  if (status === 'selected') return 'Selected';
  if (status === 'interview') return 'Interview';
  if (status === 'inreview') return 'Shortlisted';
  return 'Applied';
};

const statusBadgeClass = (status) => {
  if (status === 'Selected') return 'text-emerald-600 border-emerald-200 bg-emerald-500/10';
  if (status === 'Accepted') return 'text-cyan-600 border-blue-200 bg-cyan-500/10';
  if (status === 'Interview') return 'text-amber-600 border-amber-200 bg-amber-500/10';
  if (status === 'Rejected') return 'text-red-600 border-red-200 bg-rose-500/10';
  return 'text-slate-700 border-slate-300 bg-slate-50 border-slate-200 text-slate-600';
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

function AdminKpiTile({ label, value, hint, tone = 'cyan' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'blue'
      ? 'border-blue-200 bg-blue-50'
      : 'border-cyan-200 bg-cyan-50';

  return (
    <article className={`bg-white rounded-xl shadow-sm px-4 py-3 border-t-4 ${toneClass} border-x border-b border-x-slate-200 border-b-slate-200`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">{label}</p>
      <p className="text-3xl font-black text-slate-800 mt-1">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1 font-medium">{hint}</p>
    </article>
  );
}

function AdminSectionShell({ icon: Icon, title, subtitle, badge, actions, className = '', children }) {
  return (
    <section className={`bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden ${className}`}>
      <header className="px-5 md:px-6 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3 bg-slate-50">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white text-blue-600 border border-slate-200 shadow-sm">
              <Icon size={17} />
            </span>
          ) : null}
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-200 text-blue-600 bg-blue-50 font-bold">
              {badge}
            </span>
          ) : null}
          {actions}
        </div>
      </header>
      <div className="px-5 md:px-6 py-5">{children}</div>
    </section>
  );
}

export default function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || localStorage.getItem('admin_users_search') || '');
  const [adminTab, setAdminTab] = useState(searchParams.get('tab') || localStorage.getItem('admin_panel_tab') || 'users');
  const [sortBy, setSortBy] = useState(localStorage.getItem('admin_users_sort') || 'name_asc');
  const [userQuickFilter, setUserQuickFilter] = useState(localStorage.getItem('admin_users_quick_filter') || 'all');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const cached = localStorage.getItem('admin_users_columns');
    if (!cached) return DEFAULT_VISIBLE_COLUMNS;
    try {
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS;
      const next = parsed.filter((column) => DEFAULT_VISIBLE_COLUMNS.includes(column));
      return next.length ? next : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });
  const [savedViews, setSavedViews] = useState(() => {
    const cached = localStorage.getItem(FILTER_PRESET_KEY);
    if (!cached) return [];
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newViewName, setNewViewName] = useState('');
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailMessage, setBulkEmailMessage] = useState('');
  const [bulkEmailSending, setBulkEmailSending] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteMeta, setInviteMeta] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);
  const [selectedResetUserId, setSelectedResetUserId] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCodeData, setResetCodeData] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [temporaryAccessRows, setTemporaryAccessRows] = useState([]);
  const [temporaryAccessLoading, setTemporaryAccessLoading] = useState(true);
  const [temporaryAccessBusy, setTemporaryAccessBusy] = useState(false);
  const [temporaryRevokeBusyId, setTemporaryRevokeBusyId] = useState('');
  const [temporaryAccessForm, setTemporaryAccessForm] = useState({
    userId: '',
    hours: 8,
    mode: 'read-only',
    sections: 'dashboard, projects, meetings, events, learning, programs, community, inventory, profile, guidelines',
  });
  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState(searchParams.get('appStatus') || 'All');
  const [appSearch, setAppSearch] = useState(searchParams.get('appQ') || '');
  const [appLoading, setAppLoading] = useState(true);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [draggingAppId, setDraggingAppId] = useState('');
  const [bulkRecruitmentBusy, setBulkRecruitmentBusy] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
    typedPhrase: '',
    submitting: false,
    error: '',
  });
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    role: 'all',
    type: 'info',
    link: '/dashboard',
  });

  useEffect(() => {
    loadUsers();
    loadPendingActions();
    loadTemporaryAccessUsers();
    loadApplications();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_users_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('admin_panel_tab', adminTab);
  }, [adminTab]);

  useEffect(() => {
    localStorage.setItem('admin_users_sort', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('admin_users_quick_filter', userQuickFilter);
  }, [userQuickFilter]);

  useEffect(() => {
    localStorage.setItem('admin_users_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (adminTab) next.set('tab', adminTab);
        if (searchTerm.trim()) next.set('q', searchTerm.trim());
        else next.delete('q');
        if (appFilter && appFilter !== 'All') next.set('appStatus', appFilter);
        else next.delete('appStatus');
        if (appSearch.trim()) next.set('appQ', appSearch.trim());
        else next.delete('appQ');
        return next;
      },
      { replace: true }
    );
  }, [adminTab, appFilter, appSearch, searchTerm, setSearchParams]);

  useEffect(() => {
    localStorage.setItem(FILTER_PRESET_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    if (!deleteDialog.open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDeleteDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteDialog.open]);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const currentUser = profile.result || profile;
  const currentUserId = String(currentUser?._id || '');
  const requiredDeletePhrase = useMemo(() => {
    const targetName = String(deleteDialog.user?.name || '').trim();
    return targetName ? `remove ${targetName}` : '';
  }, [deleteDialog.user]);
  const isDeletePhraseValid = useMemo(
    () =>
      String(deleteDialog.typedPhrase || '').trim() === String(requiredDeletePhrase || ''),
    [deleteDialog.typedPhrase, requiredDeletePhrase]
  );

  const loadUsers = async (page = 1, append = false) => {
    if (page > 1) setUsersLoadingMore(true);
    try {
      const res = await fetchMembers({ page, limit: 50 });
      const incomingData = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      
      setUsers(prev => append ? [...prev, ...incomingData] : incomingData);
      setUsersTotalPages(res.data?.totalPages || 1);
      setUsersPage(page);
    } catch (err) { 
      console.error("Failed to load users", err); 
      if (!append) setUsers([]);
    } finally { 
      setLoading(false); 
      setUsersLoadingMore(false);
    }
  };

  const loadMoreUsers = () => {
    if (usersPage < usersTotalPages && !usersLoadingMore) {
      loadUsers(usersPage + 1, true);
    }
  };

  const loadPendingActions = async () => {
    try {
      const { data } = await fetchPendingAdminActions();
      setPendingActions(Array.isArray(data) ? data : []);
    } catch (err) {
      // ignore
    }
  };

  const loadTemporaryAccessUsers = async () => {
    setTemporaryAccessLoading(true);
    try {
      const { data } = await fetchTemporaryAccessUsers();
      setTemporaryAccessRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setTemporaryAccessRows([]);
    } finally {
      setTemporaryAccessLoading(false);
    }
  };

  const loadApplications = async () => {
    setAppLoading(true);
    try {
      const { data } = await fetchApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setApplications([]);
    } finally {
      setAppLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const { data } = await fetchAuditLogs({ limit: 60 });
      setAuditRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change user role to ${newRole}?`)) return;
    try {
      const { data } = await updateUserByAdmin(userId, { role: newRole });
      if (data?.requiresApproval) {
        alert(data.message);
        loadPendingActions();
        return;
      }
      setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.message || "Error updating role");
    }
  };

  const handleApprovalChange = async (userId, approvalStatus) => {
    const confirmMsg = approvalStatus === 'Approved'
      ? 'Approve this account?'
      : 'Reject this account?';
    if (!window.confirm(confirmMsg)) return;
    try {
      const isVerified = approvalStatus === 'Approved';
      await updateUserByAdmin(userId, { approvalStatus, isVerified });
      setUsers(users.map(u => (
        u._id === userId ? { ...u, approvalStatus, isVerified } : u
      )));
    } catch (err) {
      alert('Error updating approval status');
    }
  };

  const handleIdCardToggle = async (userId, currentValue) => {
    const enableNext = !currentValue;
    const prompt = enableNext ? 'Enable this member ID card?' : 'Disable this member ID card?';
    if (!window.confirm(prompt)) return;

    try {
      await updateUserByAdmin(userId, { idCardEnabled: enableNext });
      setUsers((prev) =>
        prev.map((u) => (String(u._id) === String(userId) ? { ...u, idCardEnabled: enableNext } : u))
      );
      dispatchToast(`ID card ${enableNext ? 'enabled' : 'disabled'} successfully.`, 'success');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update ID card visibility');
    }
  };

  const grantTemporaryAccessForUser = async (userId, options = {}) => {
    if (!userId) return;

    const hours = Math.max(1, Math.min(168, Number(options.hours || temporaryAccessForm.hours || 8) || 8));
    const sectionsRaw = String(options.sections || temporaryAccessForm.sections || '');
    const allowedSections = sectionsRaw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);

    setTemporaryAccessBusy(true);
    try {
      await grantTemporaryAccess(userId, {
        hours,
        mode: 'read-only',
        restrictions: { allowedSections },
      });
      dispatchToast(`Temporary dashboard access granted for ${hours} hour(s).`, 'success');
      setTemporaryAccessForm((prev) => ({ ...prev, userId: '' }));
      await Promise.all([loadUsers(), loadTemporaryAccessUsers(), loadAuditLogs()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to grant temporary access');
    } finally {
      setTemporaryAccessBusy(false);
    }
  };

  const handleGrantTemporaryAccess = async () => {
    if (!temporaryAccessForm.userId) {
      alert('Select a user first.');
      return;
    }
    await grantTemporaryAccessForUser(temporaryAccessForm.userId);
  };

  const handleQuickTemporaryAccessGrant = async (userId) => {
    const confirmed = window.confirm('Grant 8-hour read-only temporary dashboard access to this user?');
    if (!confirmed) return;
    await grantTemporaryAccessForUser(userId, { hours: 8 });
  };

  const handleRevokeTemporaryAccess = async (userId) => {
    const reason = String(window.prompt('Reason for revoking this temporary access? (optional)') || '').trim();
    setTemporaryRevokeBusyId(String(userId));
    try {
      await revokeTemporaryAccess(userId, { reason });
      dispatchToast('Temporary access revoked.', 'success');
      await Promise.all([loadUsers(), loadTemporaryAccessUsers(), loadAuditLogs()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke temporary access');
    } finally {
      setTemporaryRevokeBusyId('');
    }
  };

  const openDeleteDialog = (targetUser) => {
    if (!targetUser?._id) return;
    if (String(targetUser._id) === currentUserId) {
      dispatchToast('You cannot delete your own account from admin panel.', 'error');
      return;
    }

    setDeleteDialog({
      open: true,
      user: targetUser,
      typedPhrase: '',
      submitting: false,
      error: '',
    });
  };

  const closeDeleteDialog = (force = false) => {
    setDeleteDialog((prev) => {
      if (prev.submitting && !force) return prev;
      return {
        open: false,
        user: null,
        typedPhrase: '',
        submitting: false,
        error: '',
      };
    });
  };

  const confirmDeleteFromDialog = async () => {
    const target = deleteDialog.user;
    if (!target?._id) return;

    if (!isDeletePhraseValid) {
      setDeleteDialog((prev) => ({
        ...prev,
        error: `Type "${requiredDeletePhrase}" exactly to continue.`,
      }));
      return;
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      const { data } = await deleteUser(target._id);
      if (data?.requiresApproval) {
        dispatchToast(data.message || 'Delete request requires approval.', 'info');
        await loadPendingActions();
      } else {
        setUsers((prev) => prev.filter((u) => String(u._id) !== String(target._id)));
        dispatchToast(`Removed ${target.name || 'user'} successfully.`, 'success');
      }
      closeDeleteDialog(true);
    } catch (err) {
      setDeleteDialog((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Unable to delete user.',
      }));
    }
  };

  const handleGenerateResetCode = async (userId, displayName) => {
    if (!userId) return;
    setResetLoading(true);
    try {
      const { data } = await generatePasswordResetCode(userId);
      setSelectedResetUserId(userId);
      setResetCodeData({
        resetCode: data?.resetCode || '',
        validForMinutes: data?.validForMinutes || 15,
        userName: displayName || data?.user?.name || 'Member',
        collegeId: data?.user?.collegeId || '',
      });
      setResetCopied(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate reset code');
    } finally {
      setResetLoading(false);
    }
  };

  const copyResetCode = async () => {
    if (!resetCodeData?.resetCode) return;
    try {
      await navigator.clipboard.writeText(resetCodeData.resetCode);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 1600);
    } catch (err) {
      alert('Unable to copy reset code');
    }
  };

  const handleApproveAction = async (actionId) => {
    try {
      const { data } = await approveAdminAction(actionId);
      alert(data.message || 'Approval recorded');
      await Promise.all([loadPendingActions(), loadUsers()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve action');
    }
  };

  const handleAppStatusChange = async (applicationId, status) => {
    try {
      const note = window.prompt('Add a status note (optional):');
      const payload = { status };
      if (note) payload.note = note;
      const { data } = await updateApplication(applicationId, payload);
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update application status');
    }
  };

  const handleAppAssign = async (applicationId, assignedTo) => {
    try {
      const { data } = await updateApplication(applicationId, { assignedTo });
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign application');
    }
  };

  const handleAppNote = async (applicationId) => {
    const note = window.prompt('Add internal note for this applicant:');
    if (!note) return;
    try {
      const { data } = await updateApplication(applicationId, { note });
      setApplications(applications.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add note');
    }
  };

  const handleSendAppInvite = async (applicationId) => {
    if (!window.confirm('Send invite to this applicant?')) return;
    try {
      const { data } = await sendApplicationInvite(applicationId);
      alert(`Invite sent. Code: ${data.inviteCode}`);
      loadApplications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send invite');
    }
  };

  const handleGenerateInvite = async () => {
    const normalizedMaxUses = Math.max(1, Math.min(100, Number(inviteMaxUses) || 1));
    try {
      const { data } = await generateInvite({ maxUses: normalizedMaxUses });
      setInviteCode(data?.code || '');
      setInviteMaxUses(normalizedMaxUses);
      setInviteMeta({
        maxUses: Number(data?.maxUses || normalizedMaxUses),
        currentUses: Number(data?.currentUses || 0),
        remainingUses: Number(
          data?.remainingUses ?? data?.maxUses ?? normalizedMaxUses
        ),
        expiresAt: data?.expiresAt || '',
      });
      setCopied(false);
    } catch (err) { 
      alert(err.response?.data?.message || "Error generating code"); 
    }
  };

  const handleSendInvite = async () => {
    if (!inviteCode) return alert("Generate an access code first");
    if (!recipientEmail) return alert("Please enter an email address");
    setIsSending(true);
    try {
      await sendInviteEmail({ email: recipientEmail, inviteCode });
      alert(`Success! Invite sent to ${recipientEmail}`);
      setRecipientEmail('');
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send email");
    } finally { 
      setIsSending(false); 
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const payload = {
      title: broadcastForm.title.trim(),
      message: broadcastForm.message.trim(),
      role: broadcastForm.role,
      type: broadcastForm.type,
      link: broadcastForm.link.trim(),
    };
    if (!payload.title || !payload.message) {
      alert('Broadcast title and message are required.');
      return;
    }

    setBroadcastBusy(true);
    try {
      const { data } = await broadcastNotification(payload);
      alert(`Broadcast sent to ${data?.recipientCount || 0} members.`);
      setBroadcastForm((prev) => ({ ...prev, title: '', message: '' }));
      loadAuditLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to send broadcast.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesQuery =
        !query ||
        u.name?.toLowerCase().includes(query) ||
        u.collegeId?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query);

      const approval = String(u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')).toLowerCase();
      const role = String(u.role || '').toLowerCase();
      const year = Number(u.year || 0);

      const matchesQuick =
        userQuickFilter === 'all' ||
        (userQuickFilter === 'pending' && approval === 'pending') ||
        (userQuickFilter === 'approved' && approval === 'approved') ||
        (userQuickFilter === 'admins' && (role === 'admin' || role === 'head')) ||
        (userQuickFilter === '1st' && year === 1) ||
        (userQuickFilter === '2nd+' && year >= 2) ||
        (userQuickFilter === 'alumni' && role === 'alumni');

      return matchesQuery && matchesQuick;
    });
  }, [users, searchTerm, userQuickFilter]);

  const sortedUsers = useMemo(() => {
    const [key, dir] = String(sortBy || 'name_asc').split('_');
    const factor = dir === 'desc' ? -1 : 1;

    const read = (row) => {
      if (key === 'role') return String(row.role || '');
      if (key === 'year') return Number(row.year || 0);
      if (key === 'approval') return String(row.approvalStatus || (row.isVerified ? 'Approved' : 'Pending'));
      return String(row.name || '');
    };

    return [...filteredUsers].sort((a, b) => {
      const va = read(a);
      const vb = read(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb)) * factor;
    });
  }, [filteredUsers, sortBy]);

  useEffect(() => {
    setSelectedUserIds((prev) => {
      const valid = prev.filter((id) => sortedUsers.some((row) => String(row._id) === String(id)));
      if (valid.length === prev.length) return prev;
      return valid;
    });
  }, [sortedUsers]);

  const allVisibleSelected =
    sortedUsers.length > 0 && sortedUsers.every((row) => selectedUserIds.includes(String(row._id)));

  const toggleSort = (field) => {
    setSortBy((prev) => {
      const [currentField, currentDir] = String(prev || 'name_asc').split('_');
      if (currentField === field) return `${field}_${currentDir === 'asc' ? 'desc' : 'asc'}`;
      return `${field}_asc`;
    });
  };

  const sortIndicator = (field) => {
    const [currentField, currentDir] = String(sortBy || 'name_asc').split('_');
    if (currentField !== field) return '↕';
    return currentDir === 'asc' ? '↑' : '↓';
  };

  const toggleSelectAllUsers = () => {
    if (allVisibleSelected) {
      setSelectedUserIds([]);
      return;
    }
    setSelectedUserIds(sortedUsers.map((row) => String(row._id)));
  };

  const toggleSelectUser = (userId) => {
    const id = String(userId);
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const handleBulkApproveUsers = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Approve ${selectedUserIds.length} selected user(s)?`)) return;

    setBulkBusy(true);
    try {
      for (const userId of selectedUserIds) {
        await updateUserByAdmin(userId, { approvalStatus: 'Approved', isVerified: true });
      }
      await loadUsers();
      setSelectedUserIds([]);
      alert('Selected users approved.');
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk approval failed for one or more users.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkEmailSubmit = async (e) => {
    e.preventDefault();
    if (!bulkEmailSubject || !bulkEmailMessage) {
      dispatchToast('Subject and message are required.', 'error');
      return;
    }
    setBulkEmailSending(true);
    try {
      await sendBulkEmail({
        userIds: selectedUserIds,
        subject: bulkEmailSubject,
        message: bulkEmailMessage,
      });
      dispatchToast('Bulk email sent successfully!', 'success');
      setBulkEmailModalOpen(false);
      setBulkEmailSubject('');
      setBulkEmailMessage('');
      setSelectedUserIds([]);
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to send bulk email.', 'error');
    } finally {
      setBulkEmailSending(false);
    }
  };

  const handleExportUsers = () => {
    const headers = ['Name', 'College ID', 'Email ID', 'Year', 'Batch', 'Branch', 'Contact Number'];
    const rows = sortedUsers.map((row) => [
      row.name || '',
      row.collegeId || '',
      row.email || '',
      row.year || '',
      row.batch || '',
      row.branch || '',
      row.phone || '',
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cicr-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const adminUsers = users.filter(
    (u) =>
      (String(u.role || '').toLowerCase() === 'admin' || String(u.role || '').toLowerCase() === 'head') &&
      (u.isVerified || String(u.approvalStatus || '').toLowerCase() === 'approved')
  );

  const temporaryAccessEligibleUsers = users.filter((u) => {
    const approval = String(u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')).toLowerCase();
    const role = String(u.role || '').toLowerCase();
    return approval !== 'approved' && approval !== 'rejected' && !['admin', 'head'].includes(role);
  });

  const safeTemporaryAccessRows = Array.isArray(temporaryAccessRows) ? temporaryAccessRows : [];
  const activeTemporaryAccessCount = safeTemporaryAccessRows.filter((row) => row?.temporaryAccess?.isActive).length;

  const resetEligibleUsers = users.filter((u) => String(u.approvalStatus || '').toLowerCase() !== 'rejected');
  const inviteExpiryLabel = useMemo(() => {
    const raw = inviteMeta?.expiresAt;
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
  }, [inviteMeta?.expiresAt]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = appFilter === 'All' || app.status === appFilter;
      const query = appSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        app.fullName?.toLowerCase().includes(query) ||
        app.email?.toLowerCase().includes(query) ||
        app.phone?.toLowerCase().includes(query) ||
        app.college?.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [applications, appFilter, appSearch]);

  const applicationsByLane = useMemo(() => {
    const map = {};
    RECRUITMENT_LANES.forEach((lane) => {
      map[lane.id] = [];
    });

    for (const app of filteredApplications) {
      if (String(app.status || '') === 'Rejected') continue;
      const laneId = normalizeAppStage(app);
      if (map[laneId]) map[laneId].push(app);
    }
    return map;
  }, [filteredApplications]);

  const rejectedApplications = useMemo(
    () => filteredApplications.filter((app) => String(app.status || '') === 'Rejected'),
    [filteredApplications]
  );

  useEffect(() => {
    setSelectedApplicationIds((prev) => {
      const valid = prev.filter((id) => filteredApplications.some((row) => String(row._id) === String(id)));
      if (valid.length === prev.length) return prev;
      return valid;
    });
  }, [filteredApplications]);

  const toggleColumnVisibility = (columnId) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      }
      return [...prev, columnId];
    });
  };

  const saveCurrentUserView = () => {
    const name = String(newViewName || '').trim();
    if (!name) return;
    const view = {
      id: `${Date.now()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      searchTerm,
      sortBy,
      userQuickFilter,
      visibleColumns,
    };
    setSavedViews((prev) => {
      const deduped = prev.filter((item) => String(item.name || '').toLowerCase() !== name.toLowerCase());
      return [view, ...deduped].slice(0, 8);
    });
    setNewViewName('');
  };

  const applyUserView = (view) => {
    setSearchTerm(view.searchTerm || '');
    setSortBy(view.sortBy || 'name_asc');
    setUserQuickFilter(view.userQuickFilter || 'all');
    if (Array.isArray(view.visibleColumns) && view.visibleColumns.length > 0) {
      setVisibleColumns(view.visibleColumns.filter((id) => DEFAULT_VISIBLE_COLUMNS.includes(id)));
    }
  };

  const deleteUserView = (id) => {
    setSavedViews((prev) => prev.filter((view) => String(view.id) !== String(id)));
  };

  const toggleApplicationSelection = (applicationId) => {
    const id = String(applicationId);
    setSelectedApplicationIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const allFilteredApplicationsSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((row) => selectedApplicationIds.includes(String(row._id)));

  const toggleSelectAllApplications = () => {
    if (allFilteredApplicationsSelected) {
      setSelectedApplicationIds([]);
      return;
    }
    setSelectedApplicationIds(filteredApplications.map((row) => String(row._id)));
  };

  const moveApplicationToLane = async (applicationId, laneId) => {
    const lane = RECRUITMENT_LANES.find((row) => row.id === laneId);
    if (!lane) return;
    try {
      const { data } = await updateApplication(applicationId, {
        status: lane.status,
        stage: lane.stage,
      });
      setApplications((prev) => prev.map((app) => (app._id === data._id ? data : app)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to move application.');
    }
  };

  const handleBulkMoveApplications = async (laneId) => {
    const lane = RECRUITMENT_LANES.find((row) => row.id === laneId);
    if (!lane || selectedApplicationIds.length === 0) return;
    if (!window.confirm(`Move ${selectedApplicationIds.length} selected applicant(s) to ${lane.label}?`)) return;

    setBulkRecruitmentBusy(true);
    try {
      for (const id of selectedApplicationIds) {
        await updateApplication(id, { status: lane.status, stage: lane.stage });
      }
      await loadApplications();
      setSelectedApplicationIds([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk move failed.');
    } finally {
      setBulkRecruitmentBusy(false);
    }
  };

  const adminTabs = [
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'recruitment', label: 'Recruitment', icon: ClipboardCheck },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'audit', label: 'Audit', icon: ScrollText },
    { id: 'temp-access', label: 'Temp Access', icon: Sparkles },
  ];

  const approvalSummary = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        const approval = String(user.approvalStatus || (user.isVerified ? 'Approved' : 'Pending')).toLowerCase();
        if (approval === 'approved') acc.approved += 1;
        else if (approval === 'rejected') acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { approved: 0, pending: 0, rejected: 0 }
    );
  }, [users]);

  const recruitmentSummary = useMemo(() => {
    return applications.reduce(
      (acc, app) => {
        const status = String(app.status || '').toLowerCase();
        if (status === 'selected') acc.selected += 1;
        if (status === 'interview') acc.interview += 1;
        if (status !== 'rejected') acc.active += 1;
        return acc;
      },
      { active: 0, selected: 0, interview: 0 }
    );
  }, [applications]);

  const adminKpis = [
    {
      id: 'members',
      label: 'Directory Members',
      value: users.length,
      hint: `${approvalSummary.approved} approved • ${approvalSummary.pending} pending`,
      tone: 'blue',
    },
    {
      id: 'approvals',
      label: 'Pending Approvals',
      value: pendingActions.length,
      hint: 'Admin role/delete requests awaiting quorum',
      tone: pendingActions.length > 0 ? 'amber' : 'cyan',
    },
    {
      id: 'invite',
      label: 'Active Invite Uses',
      value: inviteMeta?.remainingUses ?? 0,
      hint: inviteMeta?.expiresAt
        ? `Expires ${new Date(inviteMeta.expiresAt).toLocaleDateString()}`
        : 'Generate access key from header',
      tone: inviteMeta?.remainingUses > 0 ? 'emerald' : 'cyan',
    },
    {
      id: 'pipeline',
      label: 'Recruitment Active',
      value: recruitmentSummary.active,
      hint: `${recruitmentSummary.interview} interview • ${recruitmentSummary.selected} selected`,
      tone: 'cyan',
    },
    {
      id: 'temporary-access',
      label: 'Active Temp Access',
      value: activeTemporaryAccessCount,
      hint: `${temporaryAccessEligibleUsers.length} pending users eligible`,
      tone: activeTemporaryAccessCount > 0 ? 'emerald' : 'cyan',
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden page-motion-d">
      <div className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Admin Operations"
          title="Admin Control Center"
          subtitle="Authorization, recruitment workflow, auditability, and organization-wide communication controls."
          icon={Shield}
          actions={
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Uses</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  className="w-14 bg-transparent text-sm text-slate-800 outline-none"
                />
              </label>
              <button onClick={handleGenerateInvite} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-900 rounded-xl shadow-sm text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap">
                <UserPlus size={14} /> Generate Access Key
              </button>
            </div>
          }
        />
      </div>

      <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-slate-200 py-2 section-motion section-motion-delay-1">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 p-1 bg-slate-100 overflow-x-auto shadow-inner">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdminTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.16em] inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                adminTab === tab.id
                  ? 'text-blue-700 border border-slate-200 bg-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 section-motion section-motion-delay-2">
        {adminKpis.map((tile) => (
          <AdminKpiTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            tone={tile.tone}
          />
        ))}
      </section>

      {adminTab === 'users' && (
        <AnimatePresence>
          {inviteCode && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="border border-blue-300 bg-white shadow-sm border border-slate-200 p-6 md:p-8 rounded-[1.8rem] shadow-2xl overflow-hidden relative pro-aurora section-motion section-motion-delay-2"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
                <div className="text-center lg:text-left space-y-2">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Access Key Active</span>
                  <div className="flex items-center justify-center lg:justify-start gap-5">
                    <h3 className="text-4xl md:text-5xl font-black font-mono tracking-[0.2em] text-slate-900">{inviteCode}</h3>
                    <button aria-label="Copy invite code" onClick={copyToClipboard} className="p-3 bg-[#0a0f17] border border-slate-300 rounded-xl hover:border-blue-500 transition-all">
                      {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} className="text-slate-600" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    Usage limit: <span className="text-slate-900 font-semibold">{inviteMeta?.maxUses || 1}</span> • Remaining:{' '}
                    <span className="text-cyan-700 font-semibold">{inviteMeta?.remainingUses ?? inviteMeta?.maxUses ?? 1}</span>
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Expires in 24 hours{inviteExpiryLabel ? ` (${inviteExpiryLabel})` : ''}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center lg:text-left">Dispatch code securely</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
                      <input 
                        type="email"
                        placeholder="recipient@college.edu"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 pl-12 !rounded-2xl !py-4 !text-sm !font-semibold"
                      />
                    </div>
                    <button 
                      onClick={handleSendInvite}
                      disabled={isSending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !rounded-2xl !px-8 !py-4"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Dispatch</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {adminTab === 'temp-access' && (
      <AdminSectionShell
        icon={Sparkles}
        title="Temporary Dashboard Access Passes"
        subtitle="Grant pending users a read-only pass with strict expiry and instant revocation controls."
        badge={`${activeTemporaryAccessCount} active`}
        className="section-motion section-motion-delay-2"
        actions={(
          <button type="button" onClick={loadTemporaryAccessUsers} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5">
            Refresh Passes
          </button>
        )}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-cyan-500/15 via-[#081018] to-[#05080f] p-4 md:p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-700 font-black">Create Access Pass</p>
            <select
              value={temporaryAccessForm.userId}
              onChange={(e) => setTemporaryAccessForm((prev) => ({ ...prev, userId: e.target.value }))}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 "
            >
              <option value="">Select pending member</option>
              {temporaryAccessEligibleUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.collegeId || 'NO-ID'})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">Duration (hours)</label>
              <label className="text-xs text-slate-600">Mode</label>
              <input
                type="number"
                min={1}
                max={168}
                value={temporaryAccessForm.hours}
                onChange={(e) => setTemporaryAccessForm((prev) => ({ ...prev, hours: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400"
              />
              <select
                value={temporaryAccessForm.mode}
                onChange={(e) => setTemporaryAccessForm((prev) => ({ ...prev, mode: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 "
              >
                <option value="read-only">Read-only</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-600">Allowed sections (comma-separated)</label>
              <textarea
                rows={3}
                value={temporaryAccessForm.sections}
                onChange={(e) => setTemporaryAccessForm((prev) => ({ ...prev, sections: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 resize-none mt-1"
              />
            </div>

            <button
              type="button"
              onClick={handleGrantTemporaryAccess}
              disabled={temporaryAccessBusy || !temporaryAccessForm.userId}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !w-full !text-blue-700 !border-blue-200 !bg-cyan-500/10"
            >
              {temporaryAccessBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Grant Temporary Access
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_140px_120px_130px] gap-3 px-4 py-3 border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black">
              <span>Member</span>
              <span>Pass Window</span>
              <span>Status</span>
              <span>Mode</span>
              <span className="text-right">Action</span>
            </div>
            {temporaryAccessLoading ? (
              <div className="p-5"><DataLoading label="Loading temporary access passes..." /></div>
            ) : safeTemporaryAccessRows.length === 0 ? (
              <div className="p-5">
                <DataEmpty title="No temporary passes" hint="Grant a pass to allow pending users controlled read-only access." />
              </div>
            ) : (
              <div className="max-h-[340px] overflow-auto divide-y divide-gray-800/60">
                {safeTemporaryAccessRows.map((row) => {
                  const temp = row.temporaryAccess || {};
                  const expiryLabel = temp.expiresAt ? new Date(temp.expiresAt).toLocaleString() : 'N/A';
                  return (
                    <div
                      key={row._id}
                      className="grid grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_140px_120px_130px] gap-3 px-4 py-3 items-center"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-100 truncate">{row.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{row.collegeId || 'NO-ID'} • {row.email || 'No email'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-700">Expires {expiryLabel}</p>
                        <p className="text-[11px] text-slate-500">{temp.remainingMinutes || 0} min left</p>
                      </div>
                      <div>
                        <span
                          className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg border ${temp.isActive ? 'text-emerald-600 border-emerald-200 bg-emerald-500/10' : 'text-red-600 border-red-200 bg-rose-500/10'}`}
                        >
                          {temp.isActive ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <div className="text-xs text-cyan-700 uppercase tracking-wider">{temp.mode || 'read-only'}</div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeTemporaryAccess(row._id)}
                          disabled={temporaryRevokeBusyId === String(row._id)}
                          className="px-4 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5 !text-[10px]"
                        >
                          {temporaryRevokeBusyId === String(row._id) ? <Loader2 size={12} className="animate-spin" /> : 'Revoke'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AdminSectionShell>
      )}

      {adminTab === 'users' && (
      <>
      <AdminSectionShell
        icon={KeyRound}
        title="Password Reset Code Generator"
        subtitle="Use when email OTP is unavailable. Generates a one-time code valid for 15 minutes."
        className="section-motion section-motion-delay-2"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <select
            value={selectedResetUserId}
            onChange={(e) => setSelectedResetUserId(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none shadow-sm text-sm focus:border-blue-400"
          >
            <option value="">Select user for reset code</option>
            {resetEligibleUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.collegeId || 'NO-ID'})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const selected = resetEligibleUsers.find((u) => String(u._id) === String(selectedResetUserId));
              handleGenerateResetCode(selectedResetUserId, selected?.name);
            }}
            disabled={!selectedResetUserId || resetLoading}
            className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Generate Reset Code
          </button>
        </div>

        {resetCodeData?.resetCode && (
          <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
              Reset code for {resetCodeData.userName}
              {resetCodeData.collegeId ? ` (${resetCodeData.collegeId})` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-blue-700 font-mono text-lg tracking-[0.25em] shadow-inner">
                {resetCodeData.resetCode}
              </code>
              <button
                type="button"
                onClick={copyResetCode}
                aria-label="Copy reset code"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors bg-white shadow-sm"
                title="Copy reset code"
              >
                {resetCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-600">
              Valid for {resetCodeData.validForMinutes} minutes. Share securely with the user.
            </p>
          </div>
        )}
      </AdminSectionShell>

      {pendingActions.length > 0 && (
        <AdminSectionShell
          icon={ShieldAlert}
          title="Pending Admin Approvals"
          subtitle="Actions that require quorum-based approval are queued here."
          badge={`${pendingActions.length} pending`}
          className="section-motion section-motion-delay-2"
        >
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div key={action._id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {action.type === 'ADMIN_DELETE' ? 'Delete admin account' : `Demote admin to ${action.payload?.newRole || 'User'}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Target: {action.targetUser?.name} ({action.targetUser?.email}) • Approvals: {action.approvals?.length || 0}/3
                  </p>
                </div>
                <button
                  onClick={() => handleApproveAction(action._id)}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold transition-colors"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </AdminSectionShell>
      )}
      </>
      )}

      {adminTab === 'recruitment' && (
      <AdminSectionShell
        icon={ClipboardCheck}
        title="Recruitment Pipeline"
        subtitle="Drag and drop candidates between lanes and run stage-wise bulk operations."
        badge={`${filteredApplications.length} visible`}
        className="section-motion section-motion-delay-2"
        actions={(
          <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-slate-200 py-2 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg outline-none text-slate-800 shadow-sm"
            >
              <option value="All">All Statuses</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicants..."
                aria-label="Search applicants"
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !text-xs !pl-10 !py-2 !pr-3 min-w-[220px]"
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            type="button"
            onClick={toggleSelectAllApplications}
            className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5"
          >
            {allFilteredApplicationsSelected ? 'Unselect All' : 'Select All'}
          </button>
          <span className="text-[11px] text-slate-500 uppercase tracking-widest">
            {selectedApplicationIds.length} selected
          </span>
        </div>

        {appLoading ? (
          <DataLoading label="Loading applications..." />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-w-[1180px] xl:min-w-0">
              {RECRUITMENT_LANES.map((lane) => (
                <article
                  key={lane.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingAppId) moveApplicationToLane(draggingAppId, lane.id);
                    setDraggingAppId('');
                  }}
                  className="border border-slate-200 rounded-2xl p-3 flex flex-col min-h-[560px] bg-white shadow-sm border border-slate-200"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500 font-black">{lane.label}</p>
                      <p className="text-xs text-slate-600 mt-1">{applicationsByLane[lane.id]?.length || 0} candidates</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBulkMoveApplications(lane.id)}
                      disabled={selectedApplicationIds.length === 0 || bulkRecruitmentBusy}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-[10px] !px-2.5 !py-1.5 !tracking-widest"
                    >
                      {bulkRecruitmentBusy ? 'Moving...' : 'Move Selected'}
                    </button>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {(applicationsByLane[lane.id] || []).map((app) => (
                      <div
                        key={app._id}
                        draggable
                        onDragStart={() => setDraggingAppId(String(app._id))}
                        onDragEnd={() => setDraggingAppId('')}
                        className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing pro-row-glide"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedApplicationIds.includes(String(app._id))}
                              onChange={() => toggleApplicationSelection(app._id)}
                            />
                            <GripVertical size={13} className="text-gray-600" />
                          </label>
                          <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg border ${statusBadgeClass(app.status)}`}>
                            {app.status}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900">{app.fullName}</p>
                          <p className="text-[11px] text-slate-500">{app.email}</p>
                          <p className="text-[11px] text-gray-600">{app.phone}</p>
                        </div>

                        <div className="text-[10px] text-slate-500 uppercase tracking-wider flex flex-wrap gap-2">
                          <span>Stage {app.stage || lane.stage}</span>
                          <span>•</span>
                          <span>Year {app.year || 'N/A'}</span>
                          {app.assignedTo?.name ? (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1"><Crown size={10} className="text-blue-400" /> {app.assignedTo.name}</span>
                            </>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={app.assignedTo?._id || ''}
                            onChange={(e) => handleAppAssign(app._id, e.target.value || null)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !rounded-lg !px-2.5 !py-2 !text-[10px] !uppercase !tracking-widest "
                          >
                            <option value="">Unassigned</option>
                            {adminUsers.map((u) => (
                              <option key={u._id} value={u._id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={app.status}
                            onChange={(e) => handleAppStatusChange(app._id, e.target.value)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !rounded-lg !px-2.5 !py-2 !text-[10px] !uppercase !tracking-widest "
                          >
                            {APPLICATION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAppNote(app._id)}
                            className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-[10px] !px-2.5 !py-1.5"
                          >
                            Note
                          </button>
                          <button
                            onClick={() => handleSendAppInvite(app._id)}
                            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-[10px] !px-2.5 !py-1.5 !text-emerald-700 !border-emerald-200 !bg-emerald-500/10"
                          >
                            Invite
                          </button>
                        </div>
                      </div>
                    ))}
                    {(applicationsByLane[lane.id] || []).length === 0 && (
                      <div className="text-[11px] text-gray-600 border border-dashed border-slate-200 rounded-lg p-3 text-center">
                        No candidates in this lane.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {!appLoading && rejectedApplications.length > 0 && (
          <div className="border border-red-200 rounded-xl p-3 mt-5">
            <p className="text-xs uppercase tracking-[0.16em] text-red-600 font-black mb-2">Rejected Candidates</p>
            <div className="flex flex-wrap gap-2">
              {rejectedApplications.map((app) => (
                <span key={app._id} className="text-[11px] border border-red-200 text-red-600 px-2.5 py-1 rounded-lg">
                  {app.fullName}
                </span>
              ))}
            </div>
          </div>
        )}

        {!appLoading && filteredApplications.length === 0 && (
          <DataEmpty
            title="No applications found"
            hint="Try changing status filter or search query."
            actionLabel="Reset filters"
            onAction={() => {
              setAppFilter('All');
              setAppSearch('');
            }}
          />
        )}
      </AdminSectionShell>

      )}

      {adminTab === 'broadcast' && (
      <section className="grid grid-cols-1 gap-5 section-motion section-motion-delay-3">
        <AdminSectionShell
          icon={Megaphone}
          title="Admin Broadcast"
          subtitle="Send a system-wide notification to selected member groups."
          className="max-w-4xl"
        >
          <form onSubmit={handleBroadcast} className="space-y-3">
            <input
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Announcement title"
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400"
              maxLength={140}
            />
            <textarea
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Announcement message"
              rows={4}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 resize-none"
              maxLength={1600}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={broadcastForm.role}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, role: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !text-xs "
              >
                <option value="all">All Members</option>
                <option value="Admin">Admins</option>
                <option value="Head">Heads</option>
                <option value="User">Users</option>
                <option value="Alumni">Alumni</option>
              </select>
              <select
                value={broadcastForm.type}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, type: e.target.value }))}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !text-xs "
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="action">Action</option>
              </select>
              <input
                value={broadcastForm.link}
                onChange={(e) => setBroadcastForm((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="/dashboard"
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 !text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={broadcastBusy}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !text-blue-700 !border-blue-200 !bg-cyan-500/10"
            >
              {broadcastBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send Broadcast
            </button>
          </form>
        </AdminSectionShell>
      </section>
      )}

      {adminTab === 'audit' && (
      <section className="grid grid-cols-1 gap-5 section-motion section-motion-delay-3">
        <AdminSectionShell
          icon={ScrollText}
          title="Audit Trail"
          subtitle="Complete activity log including sign-in, sign-out, profile updates, and admin actions."
          badge={`${auditRows.length} records`}
          className="max-w-6xl"
          actions={(
            <button
              type="button"
              onClick={loadAuditLogs}
              className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-3 !py-1.5"
            >
              Refresh
            </button>
          )}
        >
          {auditLoading ? (
            <DataLoading label="Loading audit log..." />
          ) : (
            <div className="max-h-[420px] overflow-auto pr-1">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead className="sticky top-0 bg-white shadow-sm border border-slate-200 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Name</th>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Action</th>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Time</th>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Year</th>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Role</th>
                    <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {auditRows.map((row) => (
                    <tr key={row._id} className="bg-slate-50 hover:bg-white shadow-sm border border-slate-200">
                      <td className="px-3 py-2.5 text-sm text-gray-100">
                        <div className="font-semibold">{row.actor?.name || 'System'}</div>
                        <div className="text-[11px] text-slate-500">{row.actor?.collegeId || 'N/A'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-cyan-700 font-semibold">{row.action}</td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-700">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-700">{Number.isFinite(Number(row.actor?.year)) ? row.actor.year : 'N/A'}</td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-700">{row.actor?.role || 'N/A'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">{row.entityType} {row.entityId ? `• ${row.entityId}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditRows.length === 0 && <DataEmpty label="No audit entries found." />}
            </div>
          )}
        </AdminSectionShell>
      </section>
      )}

      {adminTab === 'users' && (
        <>
          <div className="ui-table-shell section-motion section-motion-delay-3 bg-white shadow-sm border border-slate-200">
            <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-slate-200 py-2 p-5 md:p-6 border-b border-slate-200 flex flex-col gap-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-blue-400" size={22} />
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Member Directory</h3>
                    <p className="text-xs text-slate-500">Sortable table with approval and role controls.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-slate-300 text-slate-700">
                    Total {users.length}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-500/10">
                    Approved {approvalSummary.approved}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-amber-200 text-amber-700 bg-amber-500/10">
                    Pending {approvalSummary.pending}
                  </span>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <div className="flex flex-col lg:flex-row gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                      type="text"
                      placeholder="Search name, reg no, email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 pl-10"
                      style={{ paddingLeft: '2.75rem' }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkEmailModalOpen(true)}
                      disabled={selectedUserIds.length === 0}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Mail size={13} />
                      Email Selected
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkApproveUsers}
                      disabled={bulkBusy || selectedUserIds.length === 0}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                    >
                      {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Approve Selected
                    </button>
                    <button type="button" onClick={handleExportUsers} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">
                      <Download size={13} />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnChooserOpen((prev) => !prev)}
                      className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                    >
                      Columns
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['approved', 'Approved'],
                    ['admins', 'Admins/Heads'],
                    ['freshers', '1st Year'],
                    ['seniors', '2nd+ Year'],
                    ['alumni', 'Alumni'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUserQuickFilter(id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border transition-colors ${
                        userQuickFilter === id
                          ? 'border-blue-200 text-blue-700 bg-cyan-500/10'
                          : 'border-slate-300 text-slate-600 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {columnChooserOpen && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">Column Chooser</p>
                    <div className="flex flex-wrap gap-2">
                      {USER_TABLE_COLUMNS.map((column) => (
                        <label
                          key={column.id}
                          className="inline-flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(column.id)}
                            onChange={() => toggleColumnVisibility(column.id)}
                          />
                          {column.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="Save current view as..."
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400"
                      />
                      <button type="button" onClick={saveCurrentUserView} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2">
                        Save View
                      </button>
                    </div>
                    {savedViews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {savedViews.map((view) => (
                          <div key={view.id} className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => applyUserView(view)}
                              className="px-2.5 py-1.5 text-xs text-slate-700 hover:bg-white/[0.04]"
                            >
                              {view.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUserView(view.id)}
                              aria-label={`Delete saved view ${view.name}`}
                              className="px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedUserIds.length > 0 && (
              <div className="px-5 py-2 border-b border-slate-200 text-xs text-cyan-700 uppercase tracking-widest">
                {selectedUserIds.length} user(s) selected
              </div>
            )}

            <div className="overflow-x-auto max-h-[72vh]">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead className="ui-table-head sticky top-0 z-10 bg-white shadow-sm border border-slate-200">
                  <tr>
                    <th className="p-4 w-10 text-center">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllUsers} />
                    </th>
                    {visibleColumns.includes('member') && (
                      <th className="p-4">
                        <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                          Member <ArrowUpDown size={11} /> {sortIndicator('name')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('role') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('role')} className="inline-flex items-center gap-1">
                          Role <ArrowUpDown size={11} /> {sortIndicator('role')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('year') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('year')} className="inline-flex items-center gap-1">
                          Year <ArrowUpDown size={11} /> {sortIndicator('year')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('approval') && (
                      <th className="p-4 text-center">
                        <button type="button" onClick={() => toggleSort('approval')} className="inline-flex items-center gap-1">
                          Approval <ArrowUpDown size={11} /> {sortIndicator('approval')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('actions') && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sortedUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-white/[0.02] transition-colors group pro-row-glide">
                      <td className="p-4 text-center align-top">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(String(u._id))}
                          onChange={() => toggleSelectUser(u._id)}
                        />
                      </td>
                      {visibleColumns.includes('member') && (
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-slate-200 flex items-center justify-center font-black text-blue-600">
                              {u.name ? u.name[0] : '?'}
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-slate-900 text-sm tracking-tight">{u.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                  <Fingerprint size={10} className="text-blue-500" /> {u.collegeId || 'NO-REG'}
                                </span>
                                <span className="text-[10px] text-gray-600">{u.email || 'No email'}</span>
                                <span className={`text-[10px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-lg border ${u.idCardEnabled !== false ? 'text-emerald-600 border-emerald-200 bg-emerald-500/10' : 'text-red-600 border-red-200 bg-rose-500/10'}`}>
                                  Card {u.idCardEnabled !== false ? 'On' : 'Off'}
                                </span>
                                {u.temporaryAccess?.isActive ? (
                                  <span className="text-[10px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-lg border text-amber-700 border-amber-200 bg-amber-500/10">
                                    Temp Pass {Math.max(0, Number(u.temporaryAccess?.remainingMinutes || 0))}m
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('role') && (
                        <td className="p-4 text-center">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            className="bg-white border border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-blue-700 shadow-sm"
                          >
                            <option value="User">User</option>
                            <option value="Head">Head</option>
                            <option value="Admin">Admin</option>
                            <option value="Alumni">Alumni</option>
                          </select>
                        </td>
                      )}
                      {visibleColumns.includes('year') && (
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-600">
                            <GraduationCap size={12} className="text-amber-400" /> {u.year || 'N/A'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('approval') && (
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-xl border ${
                              u.approvalStatus === 'Approved'
                                ? 'text-emerald-400 border-emerald-200 bg-emerald-500/10'
                                : u.approvalStatus === 'Rejected'
                                  ? 'text-red-400 border-red-500/40 bg-red-500/10'
                                  : 'text-amber-400 border-amber-200 bg-amber-500/10'
                            }`}>
                              {u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')}
                            </span>
                            {(u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')) !== 'Approved' && (
                              <>
                                <button onClick={() => handleApprovalChange(u._id, 'Approved')} className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-2 !py-1">Approve</button>
                                <button onClick={() => handleApprovalChange(u._id, 'Rejected')} className="px-4 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 !px-2 !py-1">Reject</button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('actions') && (
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              aria-label="Toggle ID card visibility"
                              onClick={() => handleIdCardToggle(u._id, u.idCardEnabled !== false)}
                              className={`px-3 py-2 rounded-xl transition-all text-[11px] font-black uppercase tracking-[0.12em] border ${u.idCardEnabled !== false ? 'text-emerald-600 border-emerald-200 bg-emerald-500/10 hover:bg-emerald-50' : 'text-cyan-700 border-blue-200 bg-cyan-500/10 hover:bg-blue-50'}`}
                              title={u.idCardEnabled !== false ? 'Disable ID card' : 'Enable ID card'}
                            >
                              {u.idCardEnabled !== false ? 'Deactivate Card' : 'Activate Card'}
                            </button>
                            {String(u.approvalStatus || (u.isVerified ? 'Approved' : 'Pending')).toLowerCase() !== 'approved' &&
                              !['admin', 'head'].includes(String(u.role || '').toLowerCase()) && (
                              <button
                                aria-label={u.temporaryAccess?.isActive ? 'Revoke temporary access' : 'Grant temporary access'}
                                onClick={() =>
                                  u.temporaryAccess?.isActive
                                    ? handleRevokeTemporaryAccess(u._id)
                                    : handleQuickTemporaryAccessGrant(u._id)
                                }
                                className={`px-3 py-2 rounded-xl transition-all text-[11px] font-black uppercase tracking-[0.12em] border ${u.temporaryAccess?.isActive ? 'text-red-600 border-red-200 bg-rose-500/10 hover:bg-red-50' : 'text-amber-700 border-amber-200 bg-amber-500/10 hover:bg-amber-50'}`}
                                title={u.temporaryAccess?.isActive ? 'Revoke temporary pass' : 'Grant 8h temporary pass'}
                              >
                                {u.temporaryAccess?.isActive ? 'Revoke Pass' : 'Grant 8h Pass'}
                              </button>
                            )}
                            <button
                              aria-label="Generate password reset code"
                              onClick={() => handleGenerateResetCode(u._id, u.name)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Generate password reset code"
                            >
                              <KeyRound size={16} />
                            </button>
                            {!['admin', 'head'].includes(String(u.role || '').toLowerCase()) && (
                              <button
                                aria-label="Delete user"
                                onClick={() => openDeleteDialog(u)}
                                disabled={String(u._id) === currentUserId}
                                className="p-2.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40"
                                title={String(u._id) === currentUserId ? 'Self-deletion is blocked' : 'Delete user'}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {usersPage < usersTotalPages && (
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                  <button
                    onClick={loadMoreUsers}
                    disabled={usersLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm bg-white border border-slate-200 text-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {usersLoadingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-slate-400" />
                        <span>Loading more...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} className="text-blue-500" />
                        <span>Load More Users ({usersPage} / {usersTotalPages})</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {sortedUsers.length === 0 && !loading && (
                <div className="p-8">
                  <DataEmpty
                    title="No users found"
                    hint="Adjust search or quick filters to widen results."
                    actionLabel="Clear user filters"
                    onAction={() => {
                      setSearchTerm('');
                      setUserQuickFilter('all');
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <CicrAssistant
            title="Admin CICR Intelligence Console"
            placeholder="Ask member-level questions (college ID/email), roles, events, contributions..."
          />
        </>
      )}

      <AnimatePresence>
        {deleteDialog.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-white shadow-sm border border-slate-200 backdrop-blur-sm px-4 py-8 overflow-y-auto"
            onClick={() => closeDeleteDialog()}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              className="mx-auto w-full max-w-2xl border border-red-500/25 bg-[#07090f] rounded-[1.75rem] shadow-[0_30px_80px_-30px_rgba(255,0,0,0.45)]"
            >
              <div className="flex items-center justify-between gap-3 px-6 md:px-8 py-5 border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-red-500/40 bg-red-500/10">
                    <ShieldAlert size={18} className="text-red-300" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/85">
                      Destructive action
                    </p>
                    <h3 id="delete-user-title" className="text-lg md:text-xl font-black tracking-tight text-slate-900">
                      Confirm User Removal
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => closeDeleteDialog()}
                  disabled={deleteDialog.submitting}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 pro-hover-lift transition-colors disabled:opacity-40"
                  aria-label="Close delete dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 md:px-8 py-6 space-y-5">
                <p className="text-sm leading-relaxed text-slate-700">
                  This permanently removes the member account and cannot be undone. To continue, type the exact
                  verification phrase below.
                </p>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Name</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.name || 'Unknown User'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">College ID</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.collegeId || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role</p>
                    <p className="mt-1 font-bold text-gray-100">{deleteDialog.user?.role || 'User'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Required Phrase</p>
                  <div className="rounded-xl border border-slate-300 bg-[#05070c] px-4 py-3 text-sm font-mono text-red-200 break-all">
                    {requiredDeletePhrase || 'remove user'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="delete-phrase-input" className="text-[10px] uppercase tracking-[0.22em] text-slate-600">
                    Type Phrase To Confirm
                  </label>
                  <input
                    id="delete-phrase-input"
                    type="text"
                    value={deleteDialog.typedPhrase}
                    onChange={(event) =>
                      setDeleteDialog((prev) => ({
                        ...prev,
                        typedPhrase: event.target.value,
                        error: '',
                      }))
                    }
                    placeholder={requiredDeletePhrase || 'remove username'}
                    className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-red-400/60"
                    autoFocus
                  />
                  {deleteDialog.error && (
                    <p className="text-xs font-medium text-red-300">{deleteDialog.error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => closeDeleteDialog()}
                  disabled={deleteDialog.submitting}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-black uppercase tracking-[0.18em] text-slate-700 hover:text-slate-900 hover:border-gray-500 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFromDialog}
                  disabled={deleteDialog.submitting || !isDeletePhraseValid}
                  className="px-5 py-2.5 rounded-xl border border-red-500/50 bg-red-500/15 text-xs font-black uppercase tracking-[0.18em] text-red-100 hover:bg-red-500/25 transition-colors disabled:opacity-40 inline-flex items-center gap-2"
                >
                  {deleteDialog.submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remove User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkEmailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-[#0a0f17] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black gradient-text-blue brand-title">Email Selected Users</h3>
                <button
                  type="button"
                  onClick={() => setBulkEmailModalOpen(false)}
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-cyan-700 font-medium tracking-wide bg-cyan-500/10 border border-blue-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
                  <Mail size={14} /> {selectedUserIds.length} Recipient(s) Selected
                </p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Subject</label>
                  <input
                    type="text"
                    value={bulkEmailSubject}
                    onChange={(e) => setBulkEmailSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Message (HTML Supported)</label>
                  <textarea
                    rows={6}
                    value={bulkEmailMessage}
                    onChange={(e) => setBulkEmailMessage(e.target.value)}
                    placeholder="Type your message here... <br>, <b>, <i> tags are supported."
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none shadow-sm focus:border-blue-400 resize-none bg-slate-50 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setBulkEmailModalOpen(false)}
                  disabled={bulkEmailSending}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-100 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkEmailSubmit}
                  disabled={bulkEmailSending || !bulkEmailSubject || !bulkEmailMessage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  {bulkEmailSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Bulk Email
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
