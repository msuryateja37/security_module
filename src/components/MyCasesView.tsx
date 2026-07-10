import React, { useMemo, useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { getViewLabelForRole } from '../security/roleAccess';
import { Briefcase, Eye, Search, UserCheck, ArrowUpCircle, X, Send, Sparkles, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useModal } from './NotificationModal';
import { triageCase } from '../utils/caseTriage';
import type { TriageResult } from '../utils/caseTriage';

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

export const MyCasesView: React.FC<MyCasesViewProps> = ({ incidents, currentUser, onUpdateIncident, onEscalateIncident, onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [coordinatorTab, setCoordinatorTab] = useState<'assigned' | 'unassigned'>('assigned');
  const [escalationCase, setEscalationCase] = useState<SecurityIncident | null>(null);
  const [escalationLevel, setEscalationLevel] = useState<SecurityIncident['escalationLevel']>('Major');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [triageTarget, setTriageTarget] = useState<SecurityIncident | null>(null);
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

  const myCases = incidents.filter(incident => {
    if (!matchesSearch(incident)) return false;

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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Open': return 'danger';
      case 'Under Investigation': return 'warning';
      case 'SAPS Case': return 'primary';
      default: return 'success';
    }
  };

  // Fine-grained workflow stage badge (falls back to the coarse status).
  // Completed cases are labelled "Approved" in this list (client preference);
  // the stored status/stage remains 'Closed' per the BRS.
  const getStageBadge = (incident: SecurityIncident) => {
    const stage = incident.workflowStage;
    if (!stage) {
      const label = incident.status === 'Closed' ? 'Approved' : incident.status;
      return { label, cls: getStatusClass(incident.status) };
    }
    const cls: Record<string, string> = {
      'Submitted': 'danger',
      'Under Review': 'warning',
      'Escalated': 'danger',
      'Investigation': 'warning',
      'Pending Approval': 'primary',
      'Approved': 'primary',
      'Closed': 'success'
    };
    const label = stage === 'Closed' ? 'Approved' : stage;
    return { label, cls: cls[stage] || 'muted' };
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">{getViewLabelForRole('my_cases', currentUser.role)}</h1>
          <p className="page-subtitle">
            {tracksOwnOnly
              ? 'Monitor status and reference details for security incidents you submitted'
              : 'Manage and update active security cases assigned to your portfolio'}
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        {currentUser.role === 'security_coordinator' && (
          <div className="horizontal-tab-bar" style={{ marginBottom: '1rem' }}>
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

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search cases by reference number, province, place or status..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Case Details</th>
                <th>Province</th>
                <th>Place of Occurrence</th>
                <th>{tracksOwnOnly ? 'Responsible Officer' : 'Assigned Coordinator'}</th>
                <th>Status</th>
                <th>Classification</th>
                {!tracksOwnOnly && <th>AI Suggestion</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myCases.map(incident => {
                const isUnassigned = isUnassignedCase(incident);
                const canEscalate = !isUnassigned && incident.status !== 'Closed' && !incident.isEscalated && ['security_coordinator', 'security_director'].includes(currentUser.role);
                const isClosed = incident.status === 'Closed' || incident.workflowStage === 'Closed';
                const triage = !tracksOwnOnly && !isClosed ? triageCase(incident) : null;
                return (
                  <tr key={incident.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => onSelectCase(incident)}
                          style={{
                            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                            fontWeight: 600, color: 'var(--color-primary)', textAlign: 'left',
                            textDecoration: 'underline', fontSize: '0.8rem'
                          }}
                          title="Open the full case file"
                        >
                          {incident.refNo}
                        </button>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          Reported: {incident.dateReported}
                        </span>
                        {incident.slaInfo && incident.status !== 'Closed' && (
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 600,
                              color: incident.slaInfo.daysRemaining < 0 ? 'var(--color-danger)'
                                : incident.slaInfo.daysRemaining <= Math.ceil(incident.slaInfo.targetDays * 0.25) ? '#d97706'
                                : 'var(--text-muted)'
                            }}
                          >
                            Day {incident.slaInfo.daysElapsed}/{incident.slaInfo.targetDays} · due {incident.slaInfo.expectedDate}
                            {incident.slaInfo.daysRemaining < 0 ? ` · overdue by ${-incident.slaInfo.daysRemaining}d` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{incident.province}</td>
                    <td style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={incident.place}>
                      {incident.place}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isUnassigned ? (
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.78rem' }}>Unassigned</span>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{incident.responsiblePerson}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStageBadge(incident).cls}`}>
                        {getStageBadge(incident).label}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, opacity: 0.9 }}>
                        {incident.classification}
                      </span>
                    </td>
                    {!tracksOwnOnly && (
                      <td>
                        {triage ? (
                          <button
                            onClick={() => setTriageTarget(incident)}
                            className={`badge ${triage.verdict === 'Routine' ? 'success' : 'warning'}`}
                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: 'none' }}
                            title="Why did the AI suggest this? Click for the full reasoning."
                          >
                            <Sparkles size={11} /> {triage.verdict}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                        {isUnassigned && currentUser.role === 'security_coordinator' && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleAssignToMe(incident)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                          >
                            <UserCheck size={12} /> Assign to Me
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          onClick={() => onSelectCase(incident)}
                          title={tracksOwnOnly ? 'Track Case' : 'View File'}
                          style={{ padding: '0.3rem 0.45rem', display: 'flex', alignItems: 'center' }}
                        >
                          <Eye size={14} />
                        </button>
                        {canEscalate && (
                          <button
                            className="btn btn-primary"
                            onClick={() => openEscalationForm(incident)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                          >
                            <ArrowUpCircle size={12} /> Escalate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {myCases.length === 0 && (
                <tr>
                  <td colSpan={tracksOwnOnly ? 7 : 8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Briefcase size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p>
                      {tracksOwnOnly
                        ? 'No submitted incidents found matching search criteria.'
                        : currentUser.role === 'security_coordinator' && coordinatorTab === 'unassigned'
                          ? 'No unassigned provincial cases found matching search criteria.'
                          : 'No assigned cases found matching search criteria.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {escalationCase && (
        <div className="drawer-backdrop" onClick={() => setEscalationCase(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--color-primary))' }}>Escalate Case</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  {escalationCase.refNo} | {escalationCase.classification} | {escalationCase.province}
                </span>
              </div>
              <button
                onClick={() => setEscalationCase(null)}
                style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}
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
                  <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--color-primary))', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={18} /> AI Case Suggestion
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    {triageTarget.refNo} | {triageTarget.classification} | {triageTarget.province}
                  </span>
                </div>
                <button
                  onClick={() => setTriageTarget(null)}
                  style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}
                  aria-label="Close AI suggestion"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="drawer-content">
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isComplex
                    ? <ShieldAlert size={28} style={{ color: '#b45309', flexShrink: 0 }} />
                    : <ShieldCheck size={28} style={{ color: '#15803d', flexShrink: 0 }} />}
                  <div>
                    <span className={`badge ${isComplex ? 'warning' : 'success'}`} style={{ marginBottom: '0.3rem', display: 'inline-block' }}>
                      Suggested: {triage.verdict}
                    </span>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>{triage.recommendation}</p>
                  </div>
                </div>

                {riskReasons.length > 0 && (
                  <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#b45309' }}>
                      Risk factors ({riskReasons.length})
                    </h4>
                    {riskReasons.map((reason, i) => (
                      <div key={i} style={{ marginBottom: i === riskReasons.length - 1 ? 0 : '0.85rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{reason.factor}</div>
                        <div style={{ fontSize: '0.82rem' }}>{reason.detail}</div>
                        {reason.basis && (
                          <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                            Basis: {reason.basis}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {mitigatingReasons.length > 0 && (
                  <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#15803d' }}>
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

                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
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
