import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SecurityIncident } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, DollarSign, ArrowRight, FileSearch, FileText, Briefcase, Clock, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { PROVINCES } from '../data/mockData';

interface DashboardViewProps {
  incidents: SecurityIncident[];
  currentUser: UserProfile;
  onNavigate: (view: string) => void;
}

interface KpiCard {
  title: string;
  icon: LucideIcon;
  iconClass: 'primary' | 'warning' | 'success' | 'danger';
  value: string;
  footer: string;
}

const isCaseClosed = (i: SecurityIncident) =>
  i.status === 'Closed' || i.workflowStage === 'Closed';

// Submitted / Under Review — waiting on the coordinator's preliminary review.
const isAwaitingReview = (i: SecurityIncident) =>
  !isCaseClosed(i) &&
  (i.workflowStage
    ? i.workflowStage === 'Submitted' || i.workflowStage === 'Under Review'
    : i.status === 'Open');

// Escalated onwards — an investigation is underway or awaiting sign-off.
const isInInvestigation = (i: SecurityIncident) =>
  !isCaseClosed(i) && !isAwaitingReview(i);

// FR-019: SLA status indicators (At Risk / Overdue) surfaced on dashboards.
const needsSlaAttention = (i: SecurityIncident) =>
  !isCaseClosed(i) && (i.slaInfo?.status === 'At Risk' || i.slaInfo?.status === 'Overdue');

// Role-based dashboards (FR-029): each role's KPIs reflect its own workload.
// `incidents` is already scoped by the server (own / province / assigned / national).
const getKpisForRole = (user: UserProfile, incidents: SecurityIncident[]): KpiCard[] => {
  const activeCases = incidents.filter(i => !isCaseClosed(i)).length;
  const closedCases = incidents.filter(isCaseClosed).length;
  const awaitingReview = incidents.filter(isAwaitingReview).length;
  const inInvestigation = incidents.filter(isInInvestigation).length;
  const slaAttention = incidents.filter(needsSlaAttention).length;
  const totalLoss = incidents.reduce((sum, i) => sum + i.lossValue, 0);

  switch (user.role) {
    case 'security_coordinator':
      return [
        { title: 'Open Provincial Cases', icon: AlertTriangle, iconClass: 'primary', value: String(activeCases), footer: `Active cases in ${user.province}` },
        { title: 'Pending My Review', icon: FileSearch, iconClass: 'warning', value: String(awaitingReview), footer: 'Submitted cases awaiting preliminary review' },
        { title: 'SLA At Risk / Overdue', icon: Clock, iconClass: 'danger', value: String(slaAttention), footer: 'Investigations nearing or past the 14-day target' },
        { title: 'Provincial Value of Loss', icon: DollarSign, iconClass: 'danger', value: `R ${totalLoss.toLocaleString()}`, footer: `Estimated losses recorded in ${user.province}` }
      ];

    case 'chief_security_investigator':
      return [
        { title: 'Assigned Investigations', icon: Briefcase, iconClass: 'primary', value: String(activeCases), footer: 'Active cases in your portfolio' },
        { title: 'Findings to Submit', icon: FileText, iconClass: 'warning', value: String(inInvestigation), footer: 'Escalated cases with investigations underway' },
        { title: 'SLA At Risk / Overdue', icon: Clock, iconClass: 'danger', value: String(slaAttention), footer: 'Investigations nearing or past the 14-day target' },
        { title: 'Completed Investigations', icon: CheckCircle, iconClass: 'success', value: String(closedCases), footer: 'Cases closed with findings approved' }
      ];

    case 'security_director': {
      const pendingApproval = incidents.filter(i => !isCaseClosed(i) && i.workflowStage === 'Pending Approval').length;
      const escalated = incidents.filter(i => !isCaseClosed(i) && Boolean(i.isEscalated)).length;
      return [
        { title: 'National Active Cases', icon: AlertTriangle, iconClass: 'primary', value: String(activeCases), footer: 'Open cases across all provinces' },
        { title: 'Pending My Approval', icon: ClipboardCheck, iconClass: 'warning', value: String(pendingApproval), footer: 'Investigation findings awaiting your decision' },
        { title: 'Escalated Cases', icon: ArrowUpRight, iconClass: 'danger', value: String(escalated), footer: 'Cases escalated for national attention' },
        { title: 'National Value of Loss', icon: DollarSign, iconClass: 'danger', value: `R ${totalLoss.toLocaleString()}`, footer: 'Estimated losses across all provinces' }
      ];
    }

    // Employees and the System Administrator only track incidents they reported.
    default:
      return [
        { title: 'My Reported Incidents', icon: Shield, iconClass: 'primary', value: String(incidents.length), footer: 'Security incidents you have submitted' },
        { title: 'Awaiting Review', icon: FileSearch, iconClass: 'warning', value: String(awaitingReview), footer: 'Pending preliminary review by the coordinator' },
        { title: 'Under Investigation', icon: TrendingUp, iconClass: 'primary', value: String(inInvestigation), footer: 'Investigations in progress on your reports' },
        { title: 'Resolved', icon: CheckCircle, iconClass: 'success', value: String(closedCases), footer: 'Closed with outcome recorded' }
      ];
  }
};

export const DashboardView: React.FC<DashboardViewProps> = ({ incidents, currentUser, onNavigate }) => {
  // All KPIs are computed from the incidents the server returned for this user
  // (already scoped to their province/role) — no seeded statistics.
  const kpis = getKpisForRole(currentUser, incidents);
  const totalLoss = incidents.reduce((sum, i) => sum + i.lossValue, 0);
  const sapsReferrals = incidents.filter(i => i.reportedToSapsSsa === 'Yes' || i.status === 'SAPS Case').length;

  // Province distribution for Chart
  const provinceCounts = PROVINCES.map(p => {
    return {
      province: p,
      count: incidents.filter(i => i.province === p).length
    };
  });
  const maxProvinceCount = Math.max(...provinceCounts.map(c => c.count), 1);

  // Loss by classification
  const classificationLosses = {
    'Unclassified': 0,
    'Restricted': 0,
    'Confidential': 0,
    'Secret': 0,
    'Top Secret': 0
  };
  incidents.forEach(i => {
    if (classificationLosses[i.classification] !== undefined) {
      classificationLosses[i.classification] += i.lossValue;
    }
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => onNavigate('report')}>
          + Report Incident
        </button>
      </div>

      {/* KPI Cards Grid — personalized per role (FR-029) */}
      <div className="grid-cols-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div className="glass-card stat-card" key={kpi.title}>
              <div className="stat-header">
                <span className="stat-title">{kpi.title}</span>
                <Icon className={`stat-icon ${kpi.iconClass}`} size={24} />
              </div>
              <div className="stat-value">{kpi.value}</div>
              <div className="stat-footer">
                <span>{kpi.footer}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main dashboard visual statistics */}
      <div className="grid-dashboard">
        {/* SVG Analytics Bar Chart */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="hsl(var(--color-primary))" />
            Security Incidents by Province
          </h3>
          <div style={{ paddingBottom: '1.5rem' }}>
            <div className="chart-container">
              {/* Y Axis labels */}
              <div className="chart-y-axis">
                <span>{maxProvinceCount}</span>
                <span>{Math.ceil(maxProvinceCount / 2)}</span>
                <span>0</span>
              </div>
              
              {/* Bars */}
              {provinceCounts.map(item => {
                const heightPercentage = (item.count / maxProvinceCount) * 100;
                return (
                  <div 
                    key={item.province}
                    className="chart-bar" 
                    style={{ height: `${Math.max(heightPercentage, 6)}%` }}
                  >
                    <div className="chart-tooltip">
                      {item.province}: {item.count} {item.count === 1 ? 'incident' : 'incidents'}
                    </div>
                    <div className="chart-label" style={{ fontSize: '0.65rem' }}>
                      {item.province.substring(0, 4)}..
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Breakdown Panel */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} color="hsl(var(--color-warning))" />
              Loss Value by Classification
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.entries(classificationLosses).map(([classType, value]) => {
                const percentage = totalLoss > 0 ? (value / totalLoss) * 100 : 0;
                let barColor = 'hsl(var(--color-primary))';
                if (classType === 'Secret') barColor = 'hsl(var(--color-warning))';
                if (classType === 'Top Secret') barColor = 'hsl(var(--color-danger))';
                if (classType === 'Restricted') barColor = 'hsl(var(--text-secondary))';

                return (
                  <div key={classType}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500 }}>{classType}</span>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>R {value.toLocaleString()} ({Math.round(percentage)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: barColor, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid hsl(var(--border-color))', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>SAPS / SSA REFERRALS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{sapsReferrals} {sapsReferrals === 1 ? 'Case' : 'Cases'} Reported</div>
              </div>
              <button
                onClick={() => onNavigate('register')}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
              >
                Register <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents Panel */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3>Recent Security Incidents</h3>
          <button className="btn btn-secondary" onClick={() => onNavigate('register')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            View All Register Cases
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ref No.</th>
                <th>Incident Description</th>
                <th>Place of occurrence</th>
                <th>Province</th>
                <th>Date of incident</th>
                <th>Value of Loss</th>
                <th>Classification</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 3).map(inc => {
                let badgeClass = 'badge primary';
                if (inc.status === 'Closed') badgeClass = 'badge success';
                if (inc.status === 'SAPS Case') badgeClass = 'badge danger';
                if (inc.status === 'Under Investigation') badgeClass = 'badge warning';

                let classificationBadge = 'badge muted';
                if (inc.classification === 'Secret') classificationBadge = 'badge warning';
                if (inc.classification === 'Top Secret') classificationBadge = 'badge danger';
                if (inc.classification === 'Restricted') classificationBadge = 'badge primary';

                return (
                  <tr key={inc.id}>
                    <td style={{ fontWeight: 600, color: 'hsl(var(--color-primary))' }}>{inc.refNo}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.natureOfLoss}
                    </td>
                    <td>{inc.place}</td>
                    <td>{inc.province}</td>
                    <td>{new Date(inc.dateTime).toLocaleDateString()}</td>
                    <td>R {inc.lossValue.toLocaleString()}</td>
                    <td>
                      <span className={classificationBadge}>{inc.classification}</span>
                    </td>
                    <td>
                      <span className={badgeClass}>{inc.status}</span>
                    </td>
                  </tr>
                );
              })}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                    No security incidents registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
