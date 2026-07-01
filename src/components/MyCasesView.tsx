import React, { useMemo, useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { getViewLabelForRole } from '../security/roleAccess';
import { Briefcase, AlertTriangle, Clock, ShieldCheck, CheckCircle2, Eye, Search, UserCheck, ArrowUpCircle, X, Send } from 'lucide-react';
import { useModal } from './NotificationModal';

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
  const { showAlert, showConfirm } = useModal();

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

    if (currentUser.role === 'employee') {
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

  const openEscalationForm = (incident: SecurityIncident) => {
    setEscalationCase(incident);
    setEscalationLevel(
      incident.classification === 'Top Secret' || incident.classification === 'Secret'
        ? 'Critical'
        : 'Major'
    );
    setEscalationReason('');
    setEscalationNotes('');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open':
        return <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />;
      case 'Under Investigation':
        return <Clock size={18} style={{ color: 'var(--color-warning)' }} />;
      case 'SAPS Case':
        return <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />;
      default:
        return <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Open': return 'danger';
      case 'Under Investigation': return 'warning';
      case 'SAPS Case': return 'primary';
      default: return 'success';
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">{getViewLabelForRole('my_cases', currentUser.role)}</h1>
          <p className="page-subtitle">
            {currentUser.role === 'employee'
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
              My Assigned ({coordinatorAssignedCount})
            </button>
            <button
              className={`horizontal-tab ${coordinatorTab === 'unassigned' ? 'active' : ''}`}
              onClick={() => setCoordinatorTab('unassigned')}
            >
              Unassigned in My Province ({coordinatorUnassignedCount})
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
                <th>{currentUser.role === 'employee' ? 'Responsible Officer' : 'Assigned Coordinator'}</th>
                <th>Status</th>
                <th>Classification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myCases.map(incident => {
                const isUnassigned = isUnassignedCase(incident);
                const canEscalate = !isUnassigned && incident.status !== 'Closed' && !incident.isEscalated && ['security_coordinator', 'security_director'].includes(currentUser.role);
                return (
                  <tr key={incident.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {incident.refNo}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Reported: {incident.dateReported}
                        </span>
                      </div>
                    </td>
                    <td>{incident.province}</td>
                    <td>{incident.place}</td>
                    <td>
                      {isUnassigned ? (
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.8rem' }}>⚠️ Unassigned</span>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{incident.responsiblePerson}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getStatusIcon(incident.status)}
                        <span className={`badge ${getStatusClass(incident.status)}`}>
                          {incident.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>
                        {incident.classification}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isUnassigned && currentUser.role === 'security_coordinator' && (
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleAssignToMe(incident)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <UserCheck size={12} /> Assign to Me
                          </button>
                        )}
                        {currentUser.role !== 'employee' && (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => onSelectCase(incident)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Eye size={12} /> View File
                          </button>
                        )}
                        {canEscalate && (
                          <button
                            className="btn btn-primary"
                            onClick={() => openEscalationForm(incident)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Briefcase size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p>
                      {currentUser.role === 'employee'
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
                  <label className="form-label">Notes for Chief / National Office</label>
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
    </div>
  );
};
