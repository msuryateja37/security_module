import React, { useMemo, useState } from 'react';
import type { SecurityIncident } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { ROLE_LABELS } from '../security/roleAccess';
import {
  Search,
  Eye,
  ShieldAlert,
  CalendarClock,
  Check,
  X,
  Info,
  BarChart3
} from 'lucide-react';
import { useModal } from './NotificationModal';
import { Pagination } from './Pagination';
import { getCaseStageLabel, getStatusChipColors } from '../utils/statusChips';

interface AllIncidentsViewProps {
  incidents: SecurityIncident[];
  currentUser: UserProfile;
  onOpenCase: (incident: SecurityIncident) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onChanged: () => void;
}

// Case-stage filter chips (labels as produced by getCaseStageLabel)
const STATUS_FILTERS = [
  'All Incidents',
  'Submitted',
  'Under Review',
  'Investigation',
  'Escalated',
  'Pending DD Review',
  'Approved'
];

const isClosed = (i: SecurityIncident) => i.status === 'Closed' || i.workflowStage === 'Closed';

// ── Small horizontal-bar chart card (no chart library in this project) ──────
const BarChartCard: React.FC<{
  title: string;
  subtitle: string;
  data: { label: string; value: number; color?: string }[];
}> = ({ title, subtitle, data }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="glass-card" style={{ padding: '1.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.15rem' }}>
        <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <p style={{ margin: '0 0 1.1rem 1.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {data.map(d => (
          <div key={d.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.28rem' }}>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
            </div>
            <div style={{ height: '8px', background: '#EEF3F0', borderRadius: '99px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(d.value / max) * 100}%`,
                  height: '100%',
                  background: d.color || 'var(--color-primary)',
                  borderRadius: '99px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No incidents in scope yet.</span>
        )}
      </div>
    </div>
  );
};

export const AllIncidentsView: React.FC<AllIncidentsViewProps> = ({
  incidents,
  currentUser,
  onOpenCase,
  authFetch,
  onChanged
}) => {
  const { showAlert } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Incidents');
  const [currentPage, setCurrentPage] = useState(1);
  // Inline extension review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fmtDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Summary metrics ───────────────────────────────────────────────────────
  const total = incidents.length;
  const closedCount = incidents.filter(isClosed).length;
  const openCount = total - closedCount;
  const escalatedCount = incidents.filter(i => i.isEscalated || i.workflowStage === 'Escalated').length;
  const pendingExtensions = useMemo(
    () => incidents.filter(i => (i.extensionStatus || '') === 'Pending'),
    [incidents]
  );

  // ── Chart data ────────────────────────────────────────────────────────────
  const statusChart = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach(i => {
      const label = getCaseStageLabel(i);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, color: getStatusChipColors(label).color }))
      .sort((a, b) => b.value - a.value);
  }, [incidents]);

  const provinceChart = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach(i => {
      const label = i.province || 'Unspecified';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 9);
  }, [incidents]);

  // ── Filtered table rows ───────────────────────────────────────────────────
  const matchesSearch = (i: SecurityIncident) => {
    const q = searchTerm.toLowerCase();
    return (
      i.refNo.toLowerCase().includes(q) ||
      i.place.toLowerCase().includes(q) ||
      i.province.toLowerCase().includes(q) ||
      getCaseStageLabel(i).toLowerCase().includes(q) ||
      (i.responsiblePerson || '').toLowerCase().includes(q)
    );
  };
  const matchesStatus = (i: SecurityIncident) =>
    statusFilter === 'All Incidents' || getCaseStageLabel(i).toLowerCase() === statusFilter.toLowerCase();

  const filtered = incidents.filter(i => matchesSearch(i) && matchesStatus(i));

  const gridCols = '1.7fr 0.9fr 1.3fr 1.4fr 1fr 1fr 0.7fr';

  // ── Extension decision ────────────────────────────────────────────────────
  const decide = async (incident: SecurityIncident, decision: 'approve' | 'deny') => {
    const note = (decisionNotes[incident.id] || '').trim();
    if (decision === 'deny' && !note) {
      showAlert('A message is required when denying an extension request.', 'Message Required', 'warning');
      return;
    }
    setBusyId(incident.id);
    try {
      const res = await authFetch(`/api/incidents/${incident.id}/extension-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note })
      });
      const json = await res.json();
      if (json.success) {
        showAlert(
          decision === 'approve'
            ? `Extension granted on ${incident.refNo}. The requester has been notified.`
            : `Extension denied on ${incident.refNo}. The requester has been notified.`,
          decision === 'approve' ? 'Extension Approved' : 'Extension Denied',
          'success'
        );
        setReviewingId(null);
        setDecisionNotes(prev => ({ ...prev, [incident.id]: '' }));
        onChanged();
      } else {
        showAlert(json.error || json.message || 'The decision could not be recorded.', 'Action Failed', 'danger');
      }
    } catch {
      showAlert('Could not reach the server. Please try again.', 'Action Failed', 'danger');
    } finally {
      setBusyId(null);
    }
  };

  const slaLine = (incident: SecurityIncident) => {
    if (!incident.slaInfo || isClosed(incident)) return null;
    const { daysElapsed, targetDays, expectedDate, daysRemaining } = incident.slaInfo;
    const color = daysRemaining < 0 ? 'var(--color-danger)'
      : daysRemaining <= Math.ceil(targetDays * 0.25) ? '#B98A2F'
      : '#8A978F';
    return (
      <span className="cell-sub" style={{ display: 'block', fontWeight: 600, color }}>
        Day {daysElapsed}/{targetDays} · due {expectedDate}
        {daysRemaining < 0 ? ` · overdue by ${-daysRemaining}d` : ''}
      </span>
    );
  };

  return (
    <div className="screen-fade-up">
      {/* Header band */}
      <div className="header-row">
        <div>
          <h1 className="page-title">All Incidents</h1>
          <p className="page-subtitle">
            National oversight of every reported security incident — {ROLE_LABELS[currentUser.role]}
          </p>
        </div>
        <div className="header-band-stats">
          <div className="header-band-stat">
            <div className="val">{total}</div>
            <div className="lbl">Total</div>
          </div>
          <div className="header-band-stat">
            <div className="val amber">{openCount}</div>
            <div className="lbl">Open</div>
          </div>
          <div className="header-band-stat">
            <div className="val" style={{ color: 'var(--color-danger)' }}>{escalatedCount}</div>
            <div className="lbl">Escalated</div>
          </div>
          <div className="header-band-stat">
            <div className="val mint">{closedCount}</div>
            <div className="lbl">Approved</div>
          </div>
        </div>
      </div>

      {/* Read-only oversight note */}
      <div className="amber-note" style={{ marginBottom: '1.25rem' }}>
        <Info size={17} strokeWidth={2} />
        <div className="txt">
          As Deputy Director you have national visibility of all incidents and can decide pending
          time-extension requests. Closing or approving the final outcome of a case remains with the
          Chief Security Director.
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <BarChartCard
          title="Incidents by Status"
          subtitle="Current workflow stage across all provinces"
          data={statusChart}
        />
        <BarChartCard
          title="Incidents by Province"
          subtitle="Provincial distribution of reported cases"
          data={provinceChart}
        />
      </div>

      {/* Pending extension requests — the DD's actionable queue */}
      {pendingExtensions.length > 0 && (
        <div className="glass-card" style={{ padding: '1.35rem', marginBottom: '1.5rem', borderLeft: '4px solid #B98A2F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <CalendarClock size={18} style={{ color: '#B98A2F' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Pending Time-Extension Requests ({pendingExtensions.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {pendingExtensions.map(incident => {
              const reviewing = reviewingId === incident.id;
              const busy = busyId === incident.id;
              return (
                <div key={incident.id} style={{ border: '1px solid #EDF2EF', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <button
                        onClick={() => onOpenCase(incident)}
                        className="cell-ref"
                        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                        title="Open the full case file"
                      >
                        {incident.refNo}
                      </button>
                      <span className="cell-sub" style={{ display: 'block', marginTop: '0.15rem' }}>
                        {incident.province} · {incident.place}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                        <strong>{incident.extensionRequestedBy}</strong>
                        {incident.extensionRequestedByRole
                          ? ` (${ROLE_LABELS[incident.extensionRequestedByRole as keyof typeof ROLE_LABELS] || incident.extensionRequestedByRole})`
                          : ''} requested{' '}
                        <strong>
                          {incident.extensionRequestedDays} working day{incident.extensionRequestedDays === 1 ? '' : 's'}
                        </strong>.
                      </span>
                      {incident.extensionRequestReason && (
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Reason: {incident.extensionRequestReason}
                        </span>
                      )}
                    </div>
                    {!reviewing && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '7px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        onClick={() => setReviewingId(incident.id)}
                      >
                        <CalendarClock size={13} /> Review
                      </button>
                    )}
                  </div>

                  {reviewing && (
                    <div style={{ marginTop: '0.85rem' }}>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Add a message (required to deny, optional to approve)…"
                        value={decisionNotes[incident.id] || ''}
                        onChange={(e) => setDecisionNotes(prev => ({ ...prev, [incident.id]: e.target.value }))}
                        style={{ resize: 'vertical', fontSize: '0.82rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-success"
                          style={{ padding: '7px 14px', fontSize: '12px' }}
                          disabled={busy}
                          onClick={() => decide(incident, 'approve')}
                        >
                          <Check size={13} /> {busy ? 'Saving…' : 'Approve Extension'}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '7px 14px', fontSize: '12px' }}
                          disabled={busy || !(decisionNotes[incident.id] || '').trim()}
                          title={(decisionNotes[incident.id] || '').trim() ? undefined : 'A message is required when denying'}
                          onClick={() => decide(incident, 'deny')}
                        >
                          <X size={13} /> Deny
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '7px 14px', fontSize: '12px' }}
                          disabled={busy}
                          onClick={() => setReviewingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incident list */}
      <div className="list-card">
        <div style={{ padding: '18px 22px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #EDF2EF' }}>
          <div className="filter-search-wrap">
            <Search size={16} />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search incidents by reference, province, place, officer or status…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                className={`filter-chip ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="list-grid-head" style={{ gridTemplateColumns: gridCols }}>
          <div>Case Details</div>
          <div>Province</div>
          <div>Place</div>
          <div>Responsible Officer</div>
          <div>Status</div>
          <div>Classification</div>
          <div style={{ textAlign: 'right' }}>View</div>
        </div>

        {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(incident => {
          const stage = getCaseStageLabel(incident);
          const isUnassigned = !incident.responsiblePerson || incident.responsiblePerson.trim() === '' || incident.responsiblePerson === 'Unassigned';
          const extPending = (incident.extensionStatus || '') === 'Pending';
          return (
            <div
              key={incident.id}
              className="list-grid-row"
              style={{ gridTemplateColumns: gridCols, cursor: 'pointer' }}
              onClick={() => onOpenCase(incident)}
            >
              <div>
                <span className="cell-ref">{incident.refNo}</span>
                {extPending && (
                  <span className="badge warning" style={{ marginLeft: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.62rem' }}>
                    <CalendarClock size={10} /> Extension pending
                  </span>
                )}
                <span className="cell-sub" style={{ display: 'block' }}>Reported {fmtDate(incident.dateReported)}</span>
                {slaLine(incident)}
              </div>
              <div className="cell-body">{incident.province}</div>
              <div className="cell-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={incident.place}>
                {incident.place}
              </div>
              <div style={{ fontWeight: 700, color: isUnassigned ? 'var(--color-danger)' : 'var(--text-primary)', fontSize: '13px' }}>
                {isUnassigned ? 'Unassigned' : incident.responsiblePerson}
              </div>
              <div>
                <span className="chip-status" style={getStatusChipColors(stage)}>{stage}</span>
              </div>
              <div>
                <span className="chip-neutral">{incident.classification}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="row-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onOpenCase(incident); }}
                  title="Open case file"
                >
                  <Eye size={15} />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="list-empty">
            <ShieldAlert size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p>No incidents found matching the current search and filters.</p>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={10}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
