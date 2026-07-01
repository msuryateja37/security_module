import React, { useState } from 'react';
import type { SecurityIncident, BackToOfficeReport, InvestigationReport } from '../types/security';
import { ClipboardCheck, ShieldAlert, Award, UserCheck, CheckCircle2, FileText } from 'lucide-react';
import { useModal } from './NotificationModal';

interface ApprovalViewProps {
  incidents: SecurityIncident[];
  btoReports: BackToOfficeReport[];
  invReports: InvestigationReport[];
  onApproveIncident: (id: string, update: Partial<SecurityIncident>) => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({ incidents, btoReports, invReports, onApproveIncident }) => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'reports'>('incidents');
  const { showAlert, showConfirm } = useModal();

  const pendingIncidents = incidents.filter(i => i.status !== 'Closed');
  const pendingBto = btoReports.slice(0, 3);
  const pendingInv = invReports.slice(0, 3);

  const handleApproveCase = (id: string, refNo: string) => {
    showConfirm({
      title: 'Approve Case Closure',
      message: `Are you sure you want to approve case ${refNo} for official closure?`,
      confirmText: 'Approve & Close Case',
      onConfirm: () => {
        onApproveIncident(id, { status: 'Closed', outcomeOfInvestigation: 'Approved and Closed by CD: Security Services.' });
        showAlert(`Case ${refNo} has been successfully approved and closed.`, 'Case Closed', 'success');
      }
    });
  };

  const handleCosignReport = (reportTitle: string) => {
    showAlert(`Report ${reportTitle} has been formally co-signed and archived by Executive Directorate.`, 'Document Co-signed', 'success');
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Approval Control Panel</h1>
          <p className="page-subtitle">Review incident notifications, sign off investigation files, and close cases</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`btn ${activeTab === 'incidents' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Incidents for Closure ({pendingIncidents.length})
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Submitted Reports Sign-off ({pendingBto.length + pendingInv.length})
        </button>
      </div>

      {activeTab === 'incidents' ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} color="hsl(var(--color-danger))" />
            Cases Awaiting Closure Sign-off
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingIncidents.map(incident => (
              <div 
                key={incident.id} 
                className="glass-card" 
                style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))', background: 'rgba(0,0,0,0.01)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{incident.refNo}</span>
                    <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      Province: {incident.province} | Loss: R {incident.lossValue.toLocaleString()}
                    </span>
                  </div>
                  <span className="badge badge-warning">{incident.status}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
                  <strong>Description of incident:</strong> {incident.natureOfLoss}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleApproveCase(incident.id, incident.refNo)}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <UserCheck size={14} /> Sign off & Close Case
                  </button>
                </div>
              </div>
            ))}
            {pendingIncidents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                <CheckCircle2 size={36} style={{ color: 'green', opacity: 0.5, marginBottom: '0.5rem' }} />
                <p>All reported security incidents have been closed and signed off.</p>
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
                    onClick={() => handleCosignReport(`BTO-${r.id}`)}
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
                    onClick={() => handleCosignReport(`INV-${r.id}`)}
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
