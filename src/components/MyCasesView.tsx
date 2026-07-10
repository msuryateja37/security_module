import React, { useMemo, useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { getViewLabelForRole } from '../security/roleAccess';
import { Briefcase, Eye, Search, UserCheck, ArrowUpCircle, X, Send, Sparkles, ShieldAlert, ShieldCheck, Check, Info } from 'lucide-react';
import { useModal } from './NotificationModal';
import { triageCase } from '../utils/caseTriage';
import type { TriageResult } from '../utils/caseTriage';
import { getCaseStageLabel, getCaseTimeline, getStatusChipColors } from '../utils/statusChips';

interface MyCasesViewProps {
  incidents: SecurityIncident[];
  currentUser: any;
  onUpdateIncident: (incident: SecurityIncident) => void;
  onEscalateIncident: (
    incidentId: string,
    escalation: Pick<SecurityIncident, 'escalationLevel' | 'escalationReason' | 'escalationNotes'>
  ) => Promise<SecurityIncident>;
  onSelectCase: (incident: SecurityIncident) => void;
}

// Status filter chips shown in the register filter bar (design handoff §4)
const STATUS_FILTERS = ['All Cases', 'Submitted', 'Under Review', 'Investigation', 'Escalated', 'Approved'];

export const MyCasesView: React.FC<MyCasesViewProps> = ({ incidents, currentUser, onUpdateIncident, onEscalateIncident, onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Cases');
  const [coordinatorTab, setCoordinatorTab] = useState<'assigned' | 'unassigned'>('assigned');
  const [escalationCase, setEscalationCase] = useState<SecurityIncident | null>(null);
  const [escalationLevel, setEscalationLevel] = useState<SecurityIncident['escalationLevel']>('Major');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [triageTarget, setTriageTarget] = useState<SecurityIncident | null>(null);
  // Quick-view case drawer (right-side panel per design handoff)
  const [drawerCase, setDrawerCase] = useState<SecurityIncident | null>(null);
  const { showAlert, showConfirm } = useModal();

  // Employees and the System Administrator only track incidents they reported themselves
  const tracksOwnOnly = currentUser.role === 'employee' || currentUser.role === 'system_administrator';

  const isUnassignedCase = (incident: SecurityIncident) => {
    return !incident.responsiblePerson || incident.responsiblePerson === 'Unassigned' || incident.responsiblePerson.trim() === '';
  };

  const matchesSearch = (incident: SecurityIncident) => {
    return (
      incident.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.place.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.province.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const coordinatorAssignedCount = useMemo(() => {
    if (currentUser.role !== 'security_coordinator') return 0;
    return incidents.filter(incident =>
      incident.province === currentUser.province &&
      incident.responsiblePerson === currentUser.displayName
    ).length;
  }, [currentUser, incidents]);

  const coordinatorUnassignedCount = useMemo(() => {
    if (currentUser.role !== 'security_coordinator') return 0;
    return incidents.filter(incident =>
      incident.province === currentUser.province &&
      isUnassignedCase(incident)
    ).length;
  }, [currentUser, incidents]);

  // Role scoping first (server already scopes; this narrows for portfolio tabs)
  const scopedCases = incidents.filter(incident => {
    if (currentUser.role === 'security_coordinator') {
      const isProvincialMatch = incident.province === currentUser.province;
      const isAssignedToMe = incident.responsiblePerson === currentUser.displayName;
      const isUnassigned = isUnassignedCase(incident);

      if (coordinatorTab === 'assigned') {
        return isProvincialMatch && isAssignedToMe;
      }

      return isProvincialMatch && isUnassigned;
    }

    if (currentUser.role === 'chief_security_investigator') {
      return incident.responsiblePerson === currentUser.displayName;
    }

    if (tracksOwnOnly) {
      return incident.reportedBy === currentUser.displayName || incident.contactDetails === currentUser.email;
    }

    return true;
  });

  const matchesStatusFilter = (incident: SecurityIncident) => {
    if (statusFilter === 'All Cases') return true;
    return getCaseStageLabel(incident).toLowerCase() === statusFilter.toLowerCase();
  };

  const myCases = scopedCases.filter(incident => matchesSearch(incident) && matchesStatusFilter(incident));

  // Header band statistics for the current scope
  const isClosed = (i: SecurityIncident) => i.status === 'Closed' || i.workflowStage === 'Closed';
  const totalCases = scopedCases.length;
  const doneCases = scopedCases.filter(isClosed).length;
  const openCases = totalCases - doneCases;

  const handleAssignToMe = (incident: SecurityIncident) => {
    showConfirm({
      title: 'Assign Case Portfolio',
      message: `Are you sure you want to assign case ${incident.refNo} to yourself (${currentUser.displayName})?`,
      confirmText: 'Yes, Assign Case',
      onConfirm: () => {
        const updated: SecurityIncident = {
          ...incident,
          responsiblePerson: currentUser.displayName
        };
        onUpdateIncident(updated);
        showAlert(`Case ${incident.refNo} has been successfully assigned to your portfolio.`, 'Case Assigned', 'success');
      }
    });
  };

  const openEscalationForm = (incident: SecurityIncident, suggestedReason = '') => {
    setEscalationCase(incident);
    setEscalationLevel(
      incident.classification === 'Top Secret' || incident.classification === 'Secret'
        ? 'Critical'
        : 'Major'
    );
    setEscalationReason(suggestedReason);
    setEscalationNotes('');
  };

  // Map the triage engine's strongest risk factor onto the escalation form's reason options.
  const suggestEscalationReason = (triage: TriageResult): string => {
    const factors = triage.reasons.filter(r => r.kind === 'risk').map(r => r.factor);
    if (factors.some(f => f.includes('classification'))) return 'Sensitive classification or confidential information exposure';
    if (factors.includes('Criminal matter')) return 'Potential criminal matter requiring executive visibility';
    if (factors.some(f => f.includes('injuries') || f.includes('Injuries') || f.includes('High-risk') || f.includes('loss'))) return 'High-risk or major security breach';
    if (factors.some(f => f.includes('overdue') || f.includes('SLA'))) return 'SLA risk or overdue investigation';
    return 'Complex investigation requires national support';
  };

  const handleEscalate = () => {
    if (!escalationCase || !escalationReason.trim()) {
      showAlert('Select an escalation reason before submitting.', 'Escalation Required', 'warning');
      return;
    }

    setIsEscalating(true);
    onEscalateIncident(escalationCase.id, {
      escalationLevel,
      escalationReason: escalationReason.trim(),
      escalationNotes: escalationNotes.trim()
    })
      .then((updated) => {
        showAlert(
          `Case ${updated.refNo} has been escalated to ${updated.escalatedTo || updated.responsiblePerson}.`,
          'Case Escalated',
          'success'
        );
        setEscalationCase(null);
      })
      .catch((err) => {
        showAlert(err.message || 'Unable to escalate this case.', 'Escalation Failed', 'danger');
      })
      .finally(() => setIsEscalating(false));
  };

  // Some stored records carry a full ISO timestamp in dateReported — show a clean date.
  const fmtDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const gridCols = tracksOwnOnly
    ? '1.7fr 0.9fr 1.2fr 1.5fr 1fr 1fr 0.5fr'
    : '1.7fr 0.8fr 1.1fr 1.3fr 1fr 0.9fr 0.9fr 1.5fr';

  const slaLine = (incident: SecurityIncident) => {
    if (!incident.slaInfo || incident.status === 'Closed') return null;
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
          <h1 className="page-title">{getViewLabelForRole('my_cases', currentUser.role)}</h1>
          <p className="page-subtitle">
            {tracksOwnOnly
              ? 'Monitor status and reference details for security incidents you submitted'
              : 'Manage and update active security cases assigned to your portfolio'}
          </p>
        </div>
        <div className="header-band-stats">
          <div className="header-band-stat">
            <div className="val">{totalCases}</div>
            <div className="lbl">Total Cases</div>
          </div>
          <div className="header-band-stat">
            <div className="val amber">{openCases}</div>
            <div className="lbl">In Progress</div>
          </div>
          <div className="header-band-stat">
            <div className="val mint">{doneCases}</div>
            <div className="lbl">Approved</div>
          </div>
        </div>
      </div>

      {currentUser.role === 'security_coordinator' && (
        <div className="horizontal-tab-bar" style={{ marginBottom: '16px' }}>
          <button
            className={`horizontal-tab ${coordinatorTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setCoordinatorTab('assigned')}
          >
            Assigned to Me ({coordinatorAssignedCount})
          </button>
          <button
            className={`horizontal-tab ${coordinatorTab === 'unassigned' ? 'active' : ''}`}
            onClick={() => setCoordinatorTab('unassigned')}
          >
            Unassigned in {currentUser.province || 'My Province'} ({coordinatorUnassignedCount})
          </button>
        </div>
      )}

      <div className="list-card">
        {/* Filter bar: search + status chips */}
        <div style={{ padding: '18px 22px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #EDF2EF' }}>
          <div className="filter-search-wrap">
            <Search size={16} />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search cases by reference number, province, place or status..."
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

        {/* Column headers */}
        <div className="list-grid-head" style={{ gridTemplateColumns: gridCols }}>
          <div>Case Details</div>
          <div>Province</div>
          <div>Place</div>
          <div>{tracksOwnOnly ? 'Responsible Officer' : 'Assigned Coordinator'}</div>
          <div>Status</div>
          <div>Classification</div>
          {!tracksOwnOnly && <div>AI Suggestion</div>}
          <div style={{ textAlign: 'right' }}>{tracksOwnOnly ? 'View' : 'Actions'}</div>
        </div>

        {myCases.map(incident => {
          const isUnassigned = isUnassignedCase(incident);
          const canEscalate = !isUnassigned && incident.status !== 'Closed' && !incident.isEscalated && ['security_coordinator', 'security_director'].includes(currentUser.role);
          const caseClosed = isClosed(incident);
          const triage = !tracksOwnOnly && !caseClosed ? triageCase(incident) : null;
          const stage = getCaseStageLabel(incident);
          return (
            <div
              key={incident.id}
              className="list-grid-row"
              style={{ gridTemplateColumns: gridCols }}
              onClick={() => setDrawerCase(incident)}
            >
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectCase(incident); }}
                  className="cell-ref"
                  style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  title="Open the full case file"
                >
                  {incident.refNo}
                </button>
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
              {!tracksOwnOnly && (
                <div>
                  {triage ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setTriageTarget(incident); }}
                      className={`badge ${triage.verdict === 'Routine' ? 'success' : 'warning'}`}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: 'none' }}
                      title="Why did the AI suggest this? Click for the full reasoning."
                    >
                      <Sparkles size={11} /> {triage.verdict}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', whiteSpace: 'nowrap', alignItems: 'center' }}>
                {isUnassigned && currentUser.role === 'security_coordinator' && (
                  <button
                    className="btn btn-primary"
                    onClick={(e) => { e.stopPropagation(); handleAssignToMe(incident); }}
                    style={{ padding: '6px 10px', fontSize: '11.5px' }}
                  >
                    <UserCheck size={12} /> Assign to Me
                  </button>
                )}
                <button
                  className="row-icon-btn"
                  onClick={(e) => { e.stopPropagation(); setDrawerCase(incident); }}
                  title={tracksOwnOnly ? 'Track Case' : 'Quick View'}
                >
                  <Eye size={15} />
                </button>
                {canEscalate && (
                  <button
                    className="btn btn-primary"
                    onClick={(e) => { e.stopPropagation(); openEscalationForm(incident); }}
                    style={{ padding: '6px 10px', fontSize: '11.5px' }}
                  >
                    <ArrowUpCircle size={12} /> Escalate
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {myCases.length === 0 && (
          <div className="list-empty">
            <Briefcase size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p>
              {tracksOwnOnly
                ? 'No submitted incidents found matching search criteria.'
                : currentUser.role === 'security_coordinator' && coordinatorTab === 'unassigned'
                  ? 'No unassigned provincial cases found matching search criteria.'
                  : 'No assigned cases found matching search criteria.'}
            </p>
          </div>
        )}
      </div>

      {/* Case quick-view drawer (design handoff §4) */}
      {drawerCase && (() => {
        const stage = getCaseStageLabel(drawerCase);
        const chip = getStatusChipColors(stage);
        const timeline = getCaseTimeline(drawerCase);
        const sla = drawerCase.slaInfo;
        const caseDone = isClosed(drawerCase);
        return (
          <>
            <div className="case-drawer-backdrop" onClick={() => setDrawerCase(null)} />
            <div className="case-drawer">
              <div className="case-drawer-header">
                <div>
                  <div className="kick">CASE REFERENCE</div>
                  <div className="ref">{drawerCase.refNo}</div>
                  <span className="chip-status" style={{ ...chip, display: 'inline-block', marginTop: '10px' }}>{stage}</span>
                </div>
                <div style={{ flex: 1 }} />
                <button className="case-drawer-close" onClick={() => setDrawerCase(null)} aria-label="Close case panel">
                  <X size={16} />
                </button>
              </div>
              <div className="case-drawer-body">
                <div className="case-meta-grid">
                  <div className="case-meta-tile">
                    <div className="lbl">Province</div>
                    <div className="val">{drawerCase.province}</div>
                  </div>
                  <div className="case-meta-tile">
                    <div className="lbl">Place</div>
                    <div className="val">{drawerCase.place}</div>
                  </div>
                  <div className="case-meta-tile">
                    <div className="lbl">Responsible Officer</div>
                    <div className="val" style={isUnassignedCase(drawerCase) ? { color: 'var(--color-danger)' } : undefined}>
                      {isUnassignedCase(drawerCase) ? 'Unassigned' : drawerCase.responsiblePerson}
                    </div>
                  </div>
                  <div className="case-meta-tile">
                    <div className="lbl">Classification</div>
                    <div className="val">{drawerCase.classification}</div>
                  </div>
                </div>

                <div className="overline-label" style={{ letterSpacing: '0.1em', marginBottom: '14px' }}>Case Progress</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {timeline.map((step, i) => (
                    <div className="timeline-step" key={step.label}>
                      <div className="timeline-rail">
                        <div className={`timeline-dot ${step.done ? 'done' : step.current ? 'current' : ''}`}>
                          {step.done && <Check size={12} strokeWidth={3.5} />}
                        </div>
                        {i < timeline.length - 1 && (
                          <div className={`timeline-line ${step.done ? 'done' : ''}`} />
                        )}
                      </div>
                      <div className="timeline-copy">
                        <div className={`ttl ${step.done || step.current ? 'reached' : ''}`}>{step.label}</div>
                        <div className="sub">{step.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="amber-note" style={{ marginTop: '8px' }}>
                  <Info size={17} strokeWidth={2} />
                  <div className="txt">
                    {caseDone
                      ? 'This case has been finalised and the outcome recorded in the register.'
                      : sla
                        ? `Day ${sla.daysElapsed}/${sla.targetDays} · due ${sla.expectedDate} — investigations must conclude within ${sla.targetDays} working days of assignment per departmental SLA.`
                        : 'Investigations must conclude within 14 working days of assignment per departmental SLA.'}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '20px', padding: '12px' }}
                  onClick={() => { const c = drawerCase; setDrawerCase(null); onSelectCase(c); }}
                >
                  <Eye size={15} /> Open Full Case File
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {escalationCase && (
        <div className="drawer-backdrop" onClick={() => setEscalationCase(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>Escalate Case</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {escalationCase.refNo} | {escalationCase.classification} | {escalationCase.province}
                </span>
              </div>
              <button
                onClick={() => setEscalationCase(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                aria-label="Close escalation form"
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Escalation Level</label>
                  <select
                    className="form-input"
                    value={escalationLevel}
                    onChange={(e) => setEscalationLevel(e.target.value as SecurityIncident['escalationLevel'])}
                  >
                    <option value="Major">Major</option>
                    <option value="High Risk">High Risk</option>
                    <option value="Critical">Critical</option>
                    <option value="National Review">National Review</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Escalation Reason</label>
                  <select
                    className="form-input"
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                  >
                    <option value="">Select reason</option>
                    <option value="Complex investigation requires national support">Complex investigation requires national support</option>
                    <option value="High-risk or major security breach">High-risk or major security breach</option>
                    <option value="SLA risk or overdue investigation">SLA risk or overdue investigation</option>
                    <option value="Potential criminal matter requiring executive visibility">Potential criminal matter requiring executive visibility</option>
                    <option value="Sensitive classification or confidential information exposure">Sensitive classification or confidential information exposure</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Notes for Chief Security Director / National Office</label>
                  <textarea
                    rows={5}
                    className="form-input"
                    placeholder="Add investigation context, immediate risk, evidence references, or requested support..."
                    value={escalationNotes}
                    onChange={(e) => setEscalationNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn btn-primary" style={{ flexGrow: 1 }} onClick={handleEscalate} disabled={isEscalating}>
                <Send size={16} /> {isEscalating ? 'Escalating...' : 'Submit Escalation'}
              </button>
              <button className="btn btn-secondary" onClick={() => setEscalationCase(null)} disabled={isEscalating}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {triageTarget && (() => {
        const triage = triageCase(triageTarget);
        const isComplex = triage.verdict === 'Complex/High-Risk';
        const riskReasons = triage.reasons.filter(r => r.kind === 'risk');
        const mitigatingReasons = triage.reasons.filter(r => r.kind === 'mitigating');
        const canEscalateFromTriage = !isUnassignedCase(triageTarget) && triageTarget.status !== 'Closed'
          && !triageTarget.isEscalated && ['security_coordinator', 'security_director'].includes(currentUser.role);
        return (
          <div className="drawer-backdrop" onClick={() => setTriageTarget(null)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
              <div className="drawer-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={18} /> AI Case Suggestion
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {triageTarget.refNo} | {triageTarget.classification} | {triageTarget.province}
                  </span>
                </div>
                <button
                  onClick={() => setTriageTarget(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                  aria-label="Close AI suggestion"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="drawer-content">
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isComplex
                    ? <ShieldAlert size={28} style={{ color: '#B98A2F', flexShrink: 0 }} />
                    : <ShieldCheck size={28} style={{ color: '#157A5B', flexShrink: 0 }} />}
                  <div>
                    <span className={`badge ${isComplex ? 'warning' : 'success'}`} style={{ marginBottom: '0.3rem', display: 'inline-block' }}>
                      Suggested: {triage.verdict}
                    </span>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>{triage.recommendation}</p>
                  </div>
                </div>

                {riskReasons.length > 0 && (
                  <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#B98A2F' }}>
                      Risk factors ({riskReasons.length})
                    </h4>
                    {riskReasons.map((reason, i) => (
                      <div key={i} style={{ marginBottom: i === riskReasons.length - 1 ? 0 : '0.85rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{reason.factor}</div>
                        <div style={{ fontSize: '0.82rem' }}>{reason.detail}</div>
                        {reason.basis && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Basis: {reason.basis}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {mitigatingReasons.length > 0 && (
                  <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#157A5B' }}>
                      Factors supporting routine handling ({mitigatingReasons.length})
                    </h4>
                    {mitigatingReasons.map((reason, i) => (
                      <div key={i} style={{ marginBottom: i === mitigatingReasons.length - 1 ? 0 : '0.85rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{reason.factor}</div>
                        <div style={{ fontSize: '0.82rem' }}>{reason.detail}</div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  This is an automated suggestion based on the incident record and departmental policy rules.
                  The decision to close or escalate rests with the responsible officer and is recorded in the audit trail.
                </p>
              </div>

              <div className="drawer-footer">
                <button
                  className="btn btn-secondary"
                  style={{ flexGrow: 1 }}
                  onClick={() => { setTriageTarget(null); onSelectCase(triageTarget); }}
                >
                  <Eye size={16} /> Open Case File
                </button>
                {isComplex && canEscalateFromTriage && (
                  <button
                    className="btn btn-primary"
                    style={{ flexGrow: 1 }}
                    onClick={() => {
                      const suggested = suggestEscalationReason(triage);
                      setTriageTarget(null);
                      openEscalationForm(triageTarget, suggested);
                    }}
                  >
                    <ArrowUpCircle size={16} /> Escalate as Suggested
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
