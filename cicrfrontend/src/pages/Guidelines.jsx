import { CalendarCheck2, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const guidelineSections = [
  {
    icon: ShieldCheck,
    title: 'Conduct & Security',
    points: [
      'Keep all discussions respectful, technical, and traceable.',
      'Do not share private member data outside approved CICR channels.',
      'Report moderation or safety concerns to Admin immediately.',
    ],
  },
  {
    icon: Wrench,
    title: 'Project Standards',
    points: [
      'Document project goals, owners, and status updates weekly.',
      'Use reproducible setups, clear commit history, and readable PRs.',
      'Tag blockers early and avoid silent project drift.',
    ],
  },
  {
    icon: CalendarCheck2,
    title: 'Meetings & Ops',
    points: [
      'Publish agenda before meetings and action items after meetings.',
      'Track attendance and responsibilities for each event.',
      'Close loops on assigned tasks before the next sprint cycle.',
    ],
  },
  {
    icon: Users,
    title: 'Community Workflow',
    points: [
      'Use Community updates for events and important announcements.',
      'Give feedback with context, evidence, and actionable suggestions.',
      'Escalate unresolved conflicts through Admin/Head channels.',
    ],
  },
];

export default function Guidelines() {
  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl pb-10 md:pb-14 space-y-6 page-motion-d">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="CICR Handbook"
          title="Operational Guidelines"
          subtitle="Baseline operating standards for CICR projects, communication, and collaboration. Follow these rules to keep execution fast, secure, and professional."
          icon={ShieldCheck}
          badge={
            <>
              <Sparkles size={13} className="text-cyan-600" />
              Updated for current workflow standards
            </>
          }
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pro-stagger section-motion section-motion-delay-2">
        {guidelineSections.map(({ icon: Icon, title, points }) => (
          <article key={title} className="bg-white border border-slate-200 shadow-sm border border-slate-200 rounded-2xl p-5 md:p-6 pro-hover-lift">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-500/12 border border-blue-200 text-cyan-600">
              <Icon size={18} />
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-4">{title}</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700 leading-relaxed">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300/80 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 px-5 py-4 section-motion section-motion-delay-3">
        <p className="text-xs md:text-sm text-slate-600">
          Need a new rule or exception?
          <span className="text-slate-700"> Propose it in the Community page with context, impact, and owner.</span>
        </p>
      </section>
    </div>
  );
}
