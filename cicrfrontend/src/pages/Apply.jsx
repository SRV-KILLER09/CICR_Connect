import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { createApplication, fetchEvents, fetchPublicRecruitmentDrives } from '../api';
import FormField from '../components/FormField';
import useDraftForm from '../hooks/useDraftForm';
import useUnsavedChangesWarning from '../hooks/useUnsavedChangesWarning';

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  year: '',
  branch: '',
  college: '',
  interests: '',
  motivation: '',
  experience: '',
  availability: '',
  linkedin: '',
  github: '',
  portfolio: '',
  eventId: '',
  recruitmentDriveId: '',
  website: '', // honeypot
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

export default function Apply() {
  const [searchParams] = useSearchParams();
  const eventParam = searchParams.get('event') || '';
  const driveParam = searchParams.get('drive') || '';

  const [events, setEvents] = useState([]);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitNotice, setSubmitNotice] = useState('');
  
  const [dynamicResponses, setDynamicResponses] = useState({});

  const { values: form, setValues: setForm, isDirty, lastSavedAt, resetForm } = useDraftForm({
    storageKey: 'draft_public_apply_form',
    initialValues: { ...INITIAL_FORM, eventId: eventParam, recruitmentDriveId: driveParam },
  });
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        const [eventsRes, drivesRes] = await Promise.all([
          fetchEvents({ allowApplications: 'true' }).catch(() => ({ data: [] })),
          fetchPublicRecruitmentDrives().catch(() => ({ data: { data: [] } }))
        ]);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        setDrives(drivesRes.data?.data || []);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    loadOpportunities();
  }, []);

  useEffect(() => {
    if (eventParam) setForm((prev) => ({ ...prev, eventId: eventParam, recruitmentDriveId: '' }));
    if (driveParam) setForm((prev) => ({ ...prev, recruitmentDriveId: driveParam, eventId: '' }));
  }, [eventParam, driveParam, setForm]);

  const selectedEvent = useMemo(() => events.find((e) => String(e._id) === String(form.eventId)), [events, form.eventId]);
  const selectedDrive = useMemo(() => drives.find((d) => String(d._id) === String(form.recruitmentDriveId)), [drives, form.recruitmentDriveId]);

  const isRecruitment = !!selectedDrive;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitNotice) setSubmitNotice('');
  };

  const updateDynamicResponse = (fieldId, value) => {
    setDynamicResponses(prev => ({ ...prev, [fieldId]: value }));
    if (errors[`dynamic_${fieldId}`]) setErrors((prev) => ({ ...prev, [`dynamic_${fieldId}`]: '' }));
  };

  const validate = () => {
    const next = {};
    if (String(form.fullName || '').trim().length < 3) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || '').trim())) next.email = 'Enter a valid email address.';
    if (String(form.phone || '').trim().length < 8) next.phone = 'Enter a valid phone number.';

    const yearNum = Number(form.year);
    if (form.year && (!Number.isFinite(yearNum) || yearNum < 1 || yearNum > 6)) {
      next.year = 'Year must be between 1 and 6.';
    }

    if (!isRecruitment) {
      if (String(form.motivation || '').trim().length < 20) next.motivation = 'Motivation must be at least 20 characters.';
    } else if (selectedDrive?.formSchema) {
      selectedDrive.formSchema.forEach(field => {
        if (field.required && !dynamicResponses[field.label]) {
          next[`dynamic_${field.label}`] = 'This field is required.';
        }
      });
    }

    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitNotice('Please review the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitNotice('Submitting your application...');
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        year: form.year,
        branch: form.branch,
        college: form.college,
        linkedin: form.linkedin,
        github: form.github,
        portfolio: form.portfolio,
        website: form.website,
        source: 'public-apply-page',
      };

      if (isRecruitment) {
        payload.recruitmentDriveId = form.recruitmentDriveId;
        payload.dynamicResponses = dynamicResponses;
      } else {
        payload.eventId = form.eventId;
        payload.interests = form.interests;
        payload.motivation = form.motivation;
        payload.experience = form.experience;
        payload.availability = form.availability;
      }

      await createApplication(payload);
      setSubmitted(true);
      resetForm({ ...INITIAL_FORM, eventId: '', recruitmentDriveId: '' });
      setDynamicResponses({});
      dispatchToast('Application submitted successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to submit application.', 'error');
      setSubmitNotice('Submission failed. Please retry in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="border border-slate-200 rounded-4xl p-10 max-w-lg text-center shadow-lg bg-white">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-black text-slate-900 mt-4">Application Received</h2>
          <p className="text-slate-600 mt-2">Your details are now with the CICR team. Watch your email for updates.</p>
        </motion.div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400";

  return (
    <div className="min-h-screen px-4 py-12 bg-[#fafcff]">
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-blue-500 font-black">
            <ClipboardCheck size={14} /> CICR Application Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">Join the CICR Society</h1>
          <p className="text-slate-600 max-w-2xl">Submit your profile for ongoing recruitment drives or events.</p>
        </motion.header>

        <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="border border-slate-200 bg-white rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">What are you applying for?</label>
            <select
              value={form.recruitmentDriveId ? `drive_${form.recruitmentDriveId}` : form.eventId ? `event_${form.eventId}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('drive_')) {
                  updateField('recruitmentDriveId', val.replace('drive_', ''));
                  updateField('eventId', '');
                } else if (val.startsWith('event_')) {
                  updateField('eventId', val.replace('event_', ''));
                  updateField('recruitmentDriveId', '');
                } else {
                  updateField('eventId', '');
                  updateField('recruitmentDriveId', '');
                }
              }}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm cursor-pointer appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem' }}
            >
              <option value="">Select Opportunity...</option>
              {drives.length > 0 && <optgroup label="Recruitment Drives">
                {drives.map(d => <option key={d._id} value={`drive_${d._id}`}>{d.title}</option>)}
              </optgroup>}
              {events.length > 0 && <optgroup label="Events">
                {events.map(e => <option key={e._id} value={`event_${e._id}`}>{e.title}</option>)}
              </optgroup>}
            </select>
          </div>

          <div className="border-t border-slate-100 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Full Name" required error={errors.fullName}>
              <input value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="Full name" className={inputClass} />
            </FormField>
            <FormField label="Email Address" required error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="you@example.com" className={inputClass} />
            </FormField>
            <FormField label="Phone Number" required error={errors.phone}>
              <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+91 9876543210" className={inputClass} />
            </FormField>
            <FormField label="Year of Study" optional error={errors.year}>
              <input value={form.year} onChange={(e) => updateField('year', e.target.value)} placeholder="e.g. 1, 2, 3" className={inputClass} />
            </FormField>
            <FormField label="Branch / Specialization" optional>
              <input value={form.branch} onChange={(e) => updateField('branch', e.target.value)} placeholder="e.g. Computer Science" className={inputClass} />
            </FormField>
            <FormField label="College Name" optional>
              <input value={form.college} onChange={(e) => updateField('college', e.target.value)} placeholder="Your current institution" className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="LinkedIn Profile" optional><input value={form.linkedin} onChange={(e) => updateField('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." className={inputClass} /></FormField>
            <FormField label="GitHub Profile" optional><input value={form.github} onChange={(e) => updateField('github', e.target.value)} placeholder="https://github.com/..." className={inputClass} /></FormField>
            <FormField label="Portfolio Website" optional className="md:col-span-2"><input value={form.portfolio} onChange={(e) => updateField('portfolio', e.target.value)} placeholder="https://your-portfolio.com" className={inputClass} /></FormField>
          </div>

          {/* DYNAMIC OR EVENT FIELDS */}
          <div className="border-t border-slate-100 pt-8 space-y-6">
            {isRecruitment ? (
              selectedDrive.formSchema?.map(field => (
                <FormField key={field.label} label={field.label} required={field.required} error={errors[`dynamic_${field.label}`]}>
                  {field.type === 'textarea' ? (
                    <textarea rows="3" value={dynamicResponses[field.label] || ''} onChange={e => updateDynamicResponse(field.label, e.target.value)} className={inputClass} />
                  ) : field.type === 'select' ? (
                    <select value={dynamicResponses[field.label] || ''} onChange={e => updateDynamicResponse(field.label, e.target.value)} className={`${inputClass} cursor-pointer appearance-none`} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'%2364748b\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem' }}>
                      <option value="">Select...</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={dynamicResponses[field.label] || ''} onChange={e => updateDynamicResponse(field.label, e.target.value)} className={inputClass} />
                  )}
                </FormField>
              ))
            ) : (
              <div className="space-y-6">
                <FormField label="Interests" optional>
                  <input value={form.interests} onChange={(e) => updateField('interests', e.target.value)} placeholder="Topics of interest" className={inputClass} />
                </FormField>
                <FormField label="Motivation" required error={errors.motivation}>
                  <textarea rows="3" value={form.motivation} onChange={(e) => updateField('motivation', e.target.value)} placeholder="Why do you want to join?" className={inputClass} />
                </FormField>
                <FormField label="Experience" optional>
                  <textarea rows="2" value={form.experience} onChange={(e) => updateField('experience', e.target.value)} placeholder="Relevant past experience" className={inputClass} />
                </FormField>
              </div>
            )}
          </div>

          <input type="text" value={form.website} onChange={(e) => updateField('website', e.target.value)} className="hidden" tabIndex="-1" autoComplete="off" />

          {submitNotice && <div className={`text-xs font-semibold ${errors ? 'text-red-500' : 'text-blue-500'}`}>{submitNotice}</div>}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting || (!form.eventId && !form.recruitmentDriveId)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Submit Application
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
