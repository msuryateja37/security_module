import React, { useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { AlertCircle, Clock, CheckCircle2, ShieldAlert, Gavel, Search } from 'lucide-react';
import { Pagination } from './Pagination';

interface SlaMonitorViewProps {
  incidents: SecurityIncident[];
}

// Every SLA clock a case passes through, in lifecycle order (CI-009). Targets come
// from the security policy: notify the NOC immediately (12h acknowledgement),
// report breaches to SAPS/SSA within 48h, preliminary investigation 7 working days,
// full investigation 14 working days, then closure follows Director approval.
type MilestoneState = 'Completed' | 'On Track' | 'At Risk' | 'Overdue' | 'Not started';

interface Milestone {
  key: string;
  label: string;
  target: string;
  due: string;
  /** Countdown text — "3 days left", "overdue by 2 days", … */
  countdown: string;
  state: MilestoneState;
  /** 0–100 progress through the window, for the bar. */
  progress: number;
  task: string;
}

const STATE_COLOR: Record<MilestoneState, string> = {
  Completed: '#2F7D53',
  'On Track': 'hsl(var(--color-accent))',
  'At Risk': '#B98A2F',
  Overdue: 'hsl(var(--color-danger))',
  'Not started': '#8A978F'
};

const HOURS = (ms: number) => Math.floor(ms / (1000 * 60 * 60));

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

const fmtDate = (value?: string) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Escalation is a milestone in its own right — the Director owns escalated cases. */
const isEscalated = (incident: SecurityIncident) =>
  Boolean(incident.isEscalated) || incident.workflowStage === 'Escalated';

const isClosed = (incident: SecurityIncident) =>
  incident.status === 'Closed' || incident.workflowStage === 'Closed';

/** Stages that mean the field investigation has already been handed on. */
const PAST_INVESTIGATION = ['Pending DD Review', 'Pending Approval', 'Approved', 'Closed'];

const buildMilestones = (incident: SecurityIncident): Milestone[] => {
  const now = Date.now();
  const sla = incident.slaInfo;
  const reported = new Date(incident.dateReported || incident.dateCreated || incident.dateTime);
  const reportedMs = reported.getTime();
  const stage = incident.workflowStage || 'Submitted';
  const closed = isClosed(incident);
  const milestones: Milestone[] = [];

  // 1. NOC notification — acknowledged as soon as the case leaves "Submitted"
  const ackDeadline = reportedMs + 12 * 60 * 60 * 1000;
  const acknowledged = stage !== 'Submitted' || closed;
  const ackHoursLeft = HOURS(ackDeadline - now);
  milestones.push({
    key: 'noc',
    label: 'NOC notification acknowledged',
    target: '12 hours from report',
    due: new Date(ackDeadline).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    countdown: acknowledged
      ? 'Acknowledged'
      : ackHoursLeft < 0 ? `overdue by ${plural(-ackHoursLeft, 'hour')}` : `${plural(ackHoursLeft, 'hour')} left`,
    state: acknowledged ? 'Completed' : ackHoursLeft < 0 ? 'Overdue' : ackHoursLeft <= 3 ? 'At Risk' : 'On Track',
    progress: Math.min(100, Math.max(0, ((now - reportedMs) / (12 * 60 * 60 * 1000)) * 100)),
    task: 'Coordinator must verify the report and move the case into review.'
  });

  // 2. SAPS / SSA reporting — only applies to cases that are criminal or reportable
  const sapsRequired = incident.reportedToSapsSsa === 'Yes' || Boolean(incident.sapsCaseNumber);
  if (sapsRequired) {
    const sapsDeadline = reportedMs + 48 * 60 * 60 * 1000;
    const sapsDone = Boolean(incident.sapsCaseNumber);
    const sapsHoursLeft = HOURS(sapsDeadline - now);
    milestones.push({
      key: 'saps',
      label: 'Reported to SAPS / SSA',
      target: '48 hours from report',
      due: new Date(sapsDeadline).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      countdown: sapsDone
        ? `Case number ${incident.sapsCaseNumber}`
        : sapsHoursLeft < 0 ? `overdue by ${plural(-sapsHoursLeft, 'hour')}` : `${plural(sapsHoursLeft, 'hour')} left`,
      state: sapsDone ? 'Completed' : sapsHoursLeft < 0 ? 'Overdue' : sapsHoursLeft <= 12 ? 'At Risk' : 'On Track',
      progress: Math.min(100, Math.max(0, ((now - reportedMs) / (48 * 60 * 60 * 1000)) * 100)),
      task: 'Capture the SAPS case number / SSA breach reference on the case file.'
    });
  }

  // 3. Response deadline driven by classification (server-calculated)
  if (sla) {
    const hoursLeft = Math.round(sla.hoursRemaining);
    milestones.push({
      key: 'response',
      label: `Response deadline (${incident.classification || 'Unclassified'})`,
      target: 'Classification target',
      due: fmtDate(sla.deadline),
      countdown: closed
        ? 'Case closed'
        : hoursLeft < 0 ? `overdue by ${plural(-hoursLeft, 'hour')}` : `${plural(hoursLeft, 'hour')} left`,
      state: closed ? 'Completed' : sla.status === 'Overdue' ? 'Overdue' : sla.status === 'At Risk' ? 'At Risk' : 'On Track',
      progress: closed ? 100 : hoursLeft < 0 ? 100 : 100 - Math.min(100, Math.max(0, hoursLeft)),
      task: 'Complete the classification-driven response actions for this case.'
    });
  }

  // 4. Coordinator preliminary investigation window (7 working days from assignment)
  const cw = sla?.coordinatorWindow;
  if (cw) {
    milestones.push({
      key: 'preliminary',
      label: 'Preliminary investigation (Coordinator)',
      target: `${cw.targetDays} working days from assignment`,
      due: fmtDate(cw.expectedDate),
      countdown: cw.daysRemaining < 0
        ? `overdue by ${plural(-cw.daysRemaining, 'day')}`
        : `${plural(cw.daysRemaining, 'day')} left`,
      state: cw.status === 'Overdue' ? 'Overdue' : cw.status === 'At Risk' ? 'At Risk' : 'On Track',
      progress: Math.min(100, (cw.daysElapsed / Math.max(1, cw.targetDays)) * 100),
      task: 'Record preliminary findings and either close, escalate or submit for review.'
    });
  }

  // 5. Full investigation — the 14-working-day policy clock
  if (sla) {
    const done = closed || PAST_INVESTIGATION.includes(stage);
    milestones.push({
      key: 'investigation',
      label: 'Investigation report submitted',
      target: `${sla.targetDays} working days from report${sla.extensionDaysGranted ? ` (incl. ${sla.extensionDaysGranted} extension)` : ''}`,
      due: fmtDate(sla.expectedDate),
      countdown: done
        ? 'Submitted'
        : sla.daysRemaining < 0
          ? `overdue by ${plural(-sla.daysRemaining, 'day')}`
          : `${plural(sla.daysRemaining, 'day')} left`,
      state: done ? 'Completed' : sla.daysRemaining < 0 ? 'Overdue' : sla.daysRemaining <= Math.ceil(sla.targetDays * 0.25) ? 'At Risk' : 'On Track',
      progress: Math.min(100, (sla.daysElapsed / Math.max(1, sla.targetDays)) * 100),
      task: 'Investigator submits field findings for Deputy Director verification.'
    });
  }

  // 6. Escalation — shown only once a case has actually been escalated
  if (isEscalated(incident)) {
    milestones.push({
      key: 'escalation',
      label: 'Escalated to Chief Security Director',
      target: 'On escalation',
      due: fmtDate(incident.escalatedAt),
      countdown: PAST_INVESTIGATION.includes(stage) || closed ? 'Director engaged' : 'Awaiting Director action',
      state: PAST_INVESTIGATION.includes(stage) || closed ? 'Completed' : 'At Risk',
      progress: PAST_INVESTIGATION.includes(stage) || closed ? 100 : 50,
      task: 'Chief Security Director assigns an investigator or rules on the case.'
    });
  }

  // 7. Closure — completion status for the whole lifecycle
  milestones.push({
    key: 'closure',
    label: 'Case closed',
    target: 'After Director approval',
    due: fmtDate(incident.closedAt),
    countdown: closed ? `Closed ${fmtDate(incident.closedAt)}` : `Current stage: ${stage}`,
    state: closed ? 'Completed' : stage === 'Approved' ? 'On Track' : 'Not started',
    progress: closed ? 100 : stage === 'Approved' ? 80 : 20,
    task: 'Coordinator closes the case once the Director has approved the outcome.'
  });

  return milestones;
};

export const SlaMonitorView: React.FC<SlaMonitorViewProps> = ({ incidents }) => {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'All' | 'Overdue' | 'At Risk' | 'On Track' | 'Completed'>('All');
  const [search, setSearch] = useState('');

  const tracked = incidents.map(incident => {
    const milestones = buildMilestones(incident);
    const overdue = milestones.filter(m => m.state === 'Overdue').length;
    const atRisk = milestones.filter(m => m.state === 'At Risk').length;
    const completed = milestones.filter(m => m.state === 'Completed').length;
    const worst: MilestoneState = isClosed(incident)
      ? 'Completed'
      : overdue > 0 ? 'Overdue' : atRisk > 0 ? 'At Risk' : 'On Track';
    return { incident, milestones, overdue, atRisk, completed, worst };
  });

  const filtered = tracked.filter(t => {
    if (filter !== 'All' && t.worst !== filter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (t.incident.refNo || '').toLowerCase().includes(q) ||
      (t.incident.province || '').toLowerCase().includes(q) ||
      (t.incident.workflowStage || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    overdue: tracked.filter(t => t.worst === 'Overdue').length,
    atRisk: tracked.filter(t => t.worst === 'At Risk').length,
    onTrack: tracked.filter(t => t.worst === 'On Track').length,
    completed: tracked.filter(t => t.worst === 'Completed').length
  };

  const summary = [
    { label: 'Overdue', value: counts.overdue, color: 'hsl(var(--color-danger))', icon: AlertCircle },
    { label: 'At Risk', value: counts.atRisk, color: '#B98A2F', icon: Clock },
    { label: 'On Track', value: counts.onTrack, color: 'hsl(var(--color-accent))', icon: ShieldAlert },
    { label: 'Completed', value: counts.completed, color: '#2F7D53', icon: CheckCircle2 }
  ];

  return (
    <div className="screen-fade-up">
      <div className="header-row">
        <div>
          <h1 className="page-title">SLA Compliance Monitor</h1>
          <p className="page-subtitle">
            Every SLA milestone across the case lifecycle — NOC notification, SAPS/SSA reporting,
            preliminary and full investigation, escalation and closure
          </p>
        </div>
      </div>

      {/* Lifecycle summary */}
      <div className="grid-cols-4" style={{ gap: '1.25rem', marginBottom: '1.5rem' }}>
        {summary.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="stat-header">
              <span className="stat-title" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
              <Icon size={20} style={{ color }} />
            </div>
            <div className="stat-value" style={{ fontSize: '2.2rem', fontWeight: 800, color }}>{value}</div>
            <div className="stat-footer"><span>cases</span></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="filter-search-wrap">
          <Search size={16} />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search by reference, province or stage..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {(['All', 'Overdue', 'At Risk', 'On Track', 'Completed'] as const).map(f => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Per-case milestone timelines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filtered.slice((page - 1) * 10, page * 10).map(({ incident, milestones, worst, completed }) => (
          <div key={incident.id} className="glass-card" style={{ padding: '1.25rem 1.5rem', borderLeft: `4px solid ${STATE_COLOR[worst]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{incident.refNo}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                  {incident.province} · {incident.workflowStage || 'Submitted'} · reported {fmtDate(incident.dateReported)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {completed}/{milestones.length} milestones complete
                </span>
                <span className="badge" style={{ background: STATE_COLOR[worst], color: '#fff', fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}>
                  {worst}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {milestones.map(m => (
                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 2fr', gap: '0.75rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {m.state === 'Completed' && <Gavel size={12} style={{ marginRight: 4, color: STATE_COLOR.Completed }} />}
                      {m.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.target}</div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ fontWeight: 700 }}>Due:</strong> {m.due}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: STATE_COLOR[m.state] }}>
                    {m.countdown}
                  </div>
                  <div>
                    <div style={{ background: '#eee', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${m.progress}%`, background: STATE_COLOR[m.state], height: '100%' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{m.task}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            <CheckCircle2 size={24} style={{ color: 'green', display: 'block', margin: '0 auto 0.5rem auto' }} />
            No cases match this filter.
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        itemsPerPage={10}
        onPageChange={setPage}
      />
    </div>
  );
};
