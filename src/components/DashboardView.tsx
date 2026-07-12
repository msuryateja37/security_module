import React, { useEffect, useState } from 'react';
import type { SecurityIncident, TraAudit } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  AlertTriangle, 
  FileText, 
  PlusCircle, 
  ArrowRight,
  TrendingUp,
  ClipboardList,
  Sparkles
} from 'lucide-react';


interface DashboardViewProps {
  incidents: SecurityIncident[];
  currentUser: UserProfile;
  onNavigate: (view: string) => void;
  traAudits?: TraAudit[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  incidents = [], 
  currentUser, 
  onNavigate,
  traAudits = []
}) => {
  const isEmployee = currentUser.role === 'employee';

  // 1. Calculations for Admin Dashboard
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(
    i => i.status === 'Open' || i.workflowStage === 'Submitted' || i.workflowStage === 'Under Review'
  ).length;
  const escalatedIncidents = incidents.filter(
    i => i.isEscalated || i.workflowStage === 'Escalated'
  ).length;
  const traRecordsCount = traAudits.length > 0 ? traAudits.length : 1;

  // 2. Calculations for Employee Dashboard
  const myIncidents = incidents.filter(
    i => i.ownerId === currentUser.username || 
         i.reportedBy === currentUser.displayName || 
         i.contactDetails === currentUser.email
  );
  const employeeReportedCount = myIncidents.length;
  const employeeUnderInvestigation = myIncidents.filter(
    i => i.status === 'Under Investigation' || 
         i.workflowStage === 'Investigation' || 
         i.workflowStage === 'Under Review'
  ).length;
  const employeeResolvedCount = myIncidents.filter(
    i => i.status === 'Closed' || i.workflowStage === 'Closed'
  ).length;

  // 3. Resolve Role Label
  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'system_administrator': return 'Administrator';
      case 'security_coordinator': return 'Security Coordinator';
      case 'chief_security_investigator': return 'Security Investigator';
      case 'deputy_director': return 'Deputy Director';
      case 'security_director': return 'Security Director';
      case 'employee': return 'Employee';
      default: return 'Security Officer';
    }
  };

  const roleLabel = getRoleLabel(currentUser.role);
  const provinceLabel = currentUser.province || 'Gauteng';

  // 4. Render animated count values
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 750);
      setProgress(1 - Math.pow(1 - k, 3)); // ease-out cubic
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [incidents.length]);

  const animatedValue = (val: number) => {
    return Math.round(val * progress);
  };

  // EMPLOYEE DASHBOARD RENDERING (matching support/EMPLOYEE2/DASHBOARD.png)
  if (isEmployee) {
    return (
      <div className="screen-fade-up">
        {/* Breadcrumb Header */}
        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            DLRRD Security Management Services / Dashboard / Employee
          </span>
          <h1 className="page-title" style={{ margin: '0.25rem 0 0 0' }}>Security Management</h1>
        </div>

        {/* Profile Card */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-primary)' }}>{currentUser.displayName}</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {roleLabel} &bull; {provinceLabel} Province
            </p>
          </div>
          <span className="badge success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Active Profile</span>
        </div>

        {/* KPI Cards (3 Columns Layout) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* INCIDENTS REPORTED */}
          <div className="stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <div className="stat-header">
              <span className="stat-title" style={{ fontWeight: 700 }}>INCIDENTS REPORTED</span>
              <Shield size={20} className="stat-icon primary" />
            </div>
            <div className="stat-value" style={{ fontSize: '2.25rem', fontWeight: 800 }}>
              {animatedValue(employeeReportedCount)}
            </div>
            <div className="stat-footer">Total security files reported by you</div>
          </div>

          {/* UNDER INVESTIGATION */}
          <div className="stat-card" style={{ borderLeft: '4px solid #D6A331' }}>
            <div className="stat-header">
              <span className="stat-title" style={{ fontWeight: 700 }}>UNDER INVESTIGATION</span>
              <AlertTriangle size={20} className="stat-icon warning" />
            </div>
            <div className="stat-value" style={{ fontSize: '2.25rem', fontWeight: 800, color: '#D6A331' }}>
              {animatedValue(employeeUnderInvestigation)}
            </div>
            <div className="stat-footer">Active cases currently being investigated</div>
          </div>

          {/* RESOLVED */}
          <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
            <div className="stat-header">
              <span className="stat-title" style={{ fontWeight: 700 }}>RESOLVED</span>
              <Shield size={20} className="stat-icon success" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="stat-value" style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {animatedValue(employeeResolvedCount)}
            </div>
            <div className="stat-footer">Cases closed with findings completed</div>
          </div>
        </div>

        {/* Two Column Layout: Quick Actions & Incidents Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr', gap: '1.5rem' }}>
          
          {/* Left: Quick Actions */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Report a new incident */}
              <div 
                className="glass-card" 
                onClick={() => onNavigate('report')}
                style={{ padding: '1rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.5rem', borderRadius: '6px', color: 'var(--color-primary)' }}>
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem' }}>Report a new incident</h4>
                </div>
              </div>

              {/* Track my reports */}
              <div 
                className="glass-card" 
                onClick={() => onNavigate('my_cases')}
                style={{ padding: '1rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.5rem', borderRadius: '6px', color: 'var(--color-primary)' }}>
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem' }}>Track my reports</h4>
                </div>
              </div>

              {/* Ask the AI assistant */}
              <div 
                className="glass-card" 
                onClick={() => onNavigate('assistant')}
                style={{ padding: '1rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.5rem', borderRadius: '6px', color: 'var(--color-primary)' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem' }}>Ask the AI assistant</h4>
                </div>
              </div>

            </div>
          </div>

          {/* Right: My Reported Incidents Table */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>My Reported Incidents</h3>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div className="table-container">
                <table className="custom-table compact">
                  <thead>
                    <tr>
                      <th>Ref#</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>SLA</th>
                      <th>Priority</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myIncidents.map(inc => {
                      const slaStatus = inc.slaInfo?.status || 'On Track';
                      const slaBadgeClass = slaStatus === 'Overdue' ? 'danger' : slaStatus === 'At Risk' ? 'warning' : 'success';
                      return (
                        <tr key={inc.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inc.refNo}</td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(inc.dateTime).toLocaleDateString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{inc.natureOfCase || 'Theft'}</td>
                          <td>
                            <span className={`badge ${slaBadgeClass}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                              {slaStatus}
                            </span>
                          </td>
                          <td>
                             <span style={{ fontSize: '0.8rem', fontWeight: 600, color: inc.classification === 'Top Secret' || inc.classification === 'Secret' ? '#B4432D' : 'var(--text-secondary)' }}>
                               {inc.classification || 'Restricted'}
                             </span>
                           </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => onNavigate(`case:${inc.id}`)}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {myIncidents.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No incidents reported by you.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ADMINISTRATOR / OFFICER DASHBOARD RENDERING (matching support/ADMIN/Dashboard.png)
  return (
    <div className="screen-fade-up">
      {/* Header matching Dashboard.png */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {roleLabel} &bull; {provinceLabel} &bull; Reports to Adrian Ferreira
        </p>
      </div>

      {/* KPI Cards Grid matching Dashboard.png */}
      <div className="grid-cols-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* TOTAL INCIDENTS */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL INCIDENTS</span>
            <Shield size={22} className="stat-icon primary" />
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 800 }}>
            {animatedValue(totalIncidents)}
          </div>
          <div className="stat-footer">
            <span>Total security cases in scope</span>
          </div>
        </div>

        {/* OPEN */}
        <div className="stat-card" style={{ borderLeft: '4px solid #D6A331' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>OPEN</span>
            <AlertTriangle size={22} className="stat-icon warning" />
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#D6A331' }}>
            {animatedValue(openIncidents)}
          </div>
          <div className="stat-footer">
            <span>Awaiting preliminary review</span>
          </div>
        </div>

        {/* ESCALATED */}
        <div className="stat-card" style={{ borderLeft: '4px solid #B4432D' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>ESCALATED</span>
            <TrendingUp size={22} className="stat-icon danger" />
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#B4432D' }}>
            {animatedValue(escalatedIncidents)}
          </div>
          <div className="stat-footer">
            <span>Priority investigation required</span>
          </div>
        </div>

        {/* TRA RECORDS */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>TRA RECORDS</span>
            <FileText size={22} className="stat-icon success" />
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            {animatedValue(traRecordsCount)}
          </div>
          <div className="stat-footer">
            <span>Threat and Risk Assessments filed</span>
          </div>
        </div>

      </div>

      {/* Main navigation shortcut grid matching Dashboard.png layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* User Management */}
        <div 
          className="glass-card" 
          onClick={() => onNavigate('administration')}
          style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '1rem', alignItems: 'center' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(116, 71, 39, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.75rem', borderRadius: '8px', color: 'var(--color-primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>User Management</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Roles, provinces & delegation</p>
          </div>
        </div>

        {/* Breaches Register */}
        <div 
          className="glass-card" 
          onClick={() => onNavigate(currentUser.role === 'employee' ? 'my_cases' : 'register')}
          style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '1rem', alignItems: 'center' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(116, 71, 39, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.75rem', borderRadius: '8px', color: 'var(--color-primary)' }}>
            <Shield size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Breaches Register</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Master register export</p>
          </div>
        </div>

        {/* Performance Reports */}
        <div 
          className="glass-card" 
          onClick={() => onNavigate('reports_archive')}
          style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '1rem', alignItems: 'center' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(116, 71, 39, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.75rem', borderRadius: '8px', color: 'var(--color-primary)' }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Performance Reports</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Excel export by province</p>
          </div>
        </div>

        {/* System Settings */}
        <div 
          className="glass-card" 
          onClick={() => onNavigate('administration')}
          style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', gap: '1rem', alignItems: 'center' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(116, 71, 39, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ background: 'rgba(116, 71, 39, 0.08)', padding: '0.75rem', borderRadius: '8px', color: 'var(--color-primary)' }}>
            <Settings size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>System Settings</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SLAs, audit logs</p>
          </div>
        </div>

      </div>

      {/* Quick Action Links matching Dashboard.png layout */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => onNavigate(currentUser.role === 'employee' ? 'my_cases' : 'register')}
          className="btn btn-secondary" 
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          View incidents <ArrowRight size={16} />
        </button>

        <button 
          onClick={() => onNavigate('report')}
          className="btn btn-success" 
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <PlusCircle size={16} /> Report Incident
        </button>
      </div>
    </div>
  );
};
