import React, { useMemo, useState } from 'react';
import type { SecurityIncident, BackToOfficeReport, InvestigationReport } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { ClipboardCheck, ShieldAlert, Award, CheckCircle2, FileText, FolderOpen, Search, UserPlus } from 'lucide-react';
import { useModal } from './NotificationModal';
import { useBreadcrumbTail } from './Breadcrumbs';

// Approval Control Panel — role-aware workflow queues.
// Chief Security Director: escalated cases awaiting an investigator, investigations
// awaiting approval, approved cases awaiting closure.
// Security Coordinator: open provincial cases and approved cases ready to close.
// All case actions (assign / approve / return / close) live on the case file
// page (#/case/<id>); the queues are the fast way to get there.

interface ApprovalViewProps {
  incidents: SecurityIncident[];
  btoReports: BackToOfficeReport[];
  invReports: InvestigationReport[];
  currentUser: UserProfile;
  onOpenCase: (incident: SecurityIncident) => void;
}

type QueueKey = 'assign' | 'approvals' | 'closure' | 'open' | 'reports';

const stageOf = (i: SecurityIncident) => (i.workflowStage as string) || (i.status === 'Closed' ? 'Closed' : 'Submitted');

export const ApprovalView: React.FC<ApprovalViewProps> = ({ incidents, btoReports, invReports, currentUser, onOpenCase }) => {
  const isDirector = currentUser.role === 'security_director';
  const { showAlert } = useModal();

  const scoped = useMemo(
    () => (isDirector ? incidents : incidents.filter(i => i.province === currentUser.province)),
    [incidents, isDirector, currentUser.province]
  );

  const queues = useMemo(() => ({
    assign: scoped.filter(i => stageOf(i) === 'Escalated'),
    approvals: scoped.filter(i => stageOf(i) === 'Pending Approval'),
    closure: scoped.filter(i => stageOf(i) === 'Approved'),
    open: scoped.filter(i => ['Submitted', 'Under Review'].includes(stageOf(i)))
  }), [scoped]);

  const tabs: { key: QueueKey; label: string; count: number }[] = isDirector
    ? [
        { key: 'assign', label: 'Escalated — Assign Investigator', count: queues.assign.length },
        { key: 'approvals', label: 'Investigations Awaiting Approval', count: queues.approvals.length },
        { key: 'closure', label: 'Approved — Awaiting Closure', count: queues.closure.length },
        { key: 'reports', label: 'Reports Sign-off', count: Math.min(btoReports.length, 3) + Math.min(invReports.length, 3) }
      ]
    : [
        { key: 'open', label: 'Open Provincial Cases', count: queues.open.length },
        { key: 'closure', label: 'Approved — Ready to Close', count: queues.closure.length },
        { key: 'reports', label: 'Reports Sign-off', count: Math.min(btoReports.length, 3) + Math.min(invReports.length, 3) }
      ];

  const [activeTab, setActiveTab] = useState<QueueKey>(tabs[0].key);
  const activeQueue: SecurityIncident[] = activeTab === 'reports' ? [] : queues[activeTab] || [];

  useBreadcrumbTail(tabs.find(t => t.key === activeTab)?.label);

  const pendingBto = btoReports.slice(0, 3);
  const pendingInv = invReports.slice(0, 3);

  const emptyMessages: Record<QueueKey, string> = {
    assign: 'No escalated cases are waiting for an investigator.',
    approvals: 'No field investigations are awaiting your approval.',
    closure: 'No approved cases are waiting to be closed.',
    open: 'No open cases in your province right now.',
    reports: ''
  };

  const queueHint: Record<QueueKey, string> = {
    assign: 'Open a case file to assign a Chief Investigator for the field investigation.',
    approvals: 'Review the submitted field findings, then approve the investigation or return it to the investigator.',
    closure: 'The Chief Security Director approved these investigations — close each case with an outcome classification to notify the reporter.',
    open: 'Review each new case: close small cases with a report, or escalate significant cases to the Chief Security Director.',
    reports: ''
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Approval Control Panel</h1>
          <p className="page-subtitle">
            {isDirector
              ? 'Assign investigators, approve or return field investigations, and oversee closures'
              : 'Review open provincial cases and close cases approved by the Chief Security Director'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab !== 'reports' ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab === 'assign' ? <UserPlus size={20} color="hsl(var(--color-danger))" />
              : activeTab === 'approvals' ? <ClipboardCheck size={20} color="hsl(var(--color-accent))" />
              : activeTab === 'closure' ? <CheckCircle2 size={20} color="green" />
              : <Search size={20} color="hsl(var(--color-primary))" />}
            {tabs.find(t => t.key === activeTab)?.label}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>{queueHint[activeTab]}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeQueue.map(incident => (
              <div
                key={incident.id}
                className="glass-card"
                style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))', background: 'rgba(0,0,0,0.01)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <button
                      onClick={() => onOpenCase(incident)}
                      style={{
                        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)', textDecoration: 'underline'
                      }}
                      title="Open the full case file"
                    >
                      {incident.refNo}
                    </button>
                    <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      {incident.province} | {incident.classification} | Loss: R {Number(incident.lossValue || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="badge warning">{stageOf(incident)}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                  <strong>Description:</strong> {incident.natureOfLoss}
                </div>
                {activeTab === 'assign' && incident.escalationReason && (
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                    <strong>Escalated by {incident.escalatedBy}:</strong> {incident.escalationReason}
                  </div>
                )}
                {activeTab === 'approvals' && (
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                    <strong>Investigator:</strong> {incident.assignedInvestigator || '—'}
                    {incident.investigationFindings && (
                      <span> — {incident.investigationFindings.slice(0, 180)}{incident.investigationFindings.length > 180 ? '…' : ''}</span>
                    )}
                  </div>
                )}
                {activeTab === 'closure' && (
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>
                    <strong>Approved by:</strong> {incident.approvedBy || '—'} {incident.approvedAt ? `on ${new Date(incident.approvedAt).toLocaleDateString('en-ZA')}` : ''}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => onOpenCase(incident)}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <FolderOpen size={14} />
                    {activeTab === 'assign' ? 'Open Case & Assign Investigator'
                      : activeTab === 'approvals' ? 'Review Findings & Decide'
                      : activeTab === 'closure' ? 'Open Case & Close'
                      : 'Open Case File'}
                  </button>
                </div>
              </div>
            ))}
            {activeQueue.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                <ShieldAlert size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>{emptyMessages[activeTab]}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardCheck size={20} color="hsl(var(--color-accent))" />
            Submitted Operational Reports
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {pendingBto.map(r => (
              <div key={r.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))' }}>BTO Report: {r.eventName}</span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Filing Date: {r.dateCreated}</span>
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <strong>Official Name:</strong> {r.officialName} ({r.designation}) | <strong>Venue:</strong> {r.venue}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => showAlert(`Report BTO-${r.id} has been formally co-signed and archived by Executive Directorate.`, 'Document Co-signed', 'success')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Award size={14} /> Co-sign Document
                  </button>
                </div>
              </div>
            ))}

            {pendingInv.map(r => (
              <div key={r.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))' }}>Investigation: {r.subject}</span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Filing Date: {r.dateCreated}</span>
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <strong>Investigating Officer:</strong> {r.officerName} ({r.rank}) | <strong>Office:</strong> {r.office}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => showAlert(`Report INV-${r.id} has been formally co-signed and archived by Executive Directorate.`, 'Document Co-signed', 'success')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Award size={14} /> Co-sign Document
                  </button>
                </div>
              </div>
            ))}

            {pendingBto.length === 0 && pendingInv.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                <FileText size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No submitted reports awaiting review or co-signature.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
