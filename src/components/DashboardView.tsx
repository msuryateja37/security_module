import React from 'react';
import type { SecurityIncident } from '../types/security';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, DollarSign, ArrowRight, FileSearch } from 'lucide-react';
import { PROVINCES } from '../data/mockData';

interface DashboardViewProps {
  incidents: SecurityIncident[];
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ incidents, onNavigate }) => {
  // All KPIs are computed from the incidents the server returned for this user
  // (already scoped to their province/role) — no seeded statistics.
  const activeCases = incidents.filter(i => i.status !== 'Closed').length;
  const closedCases = incidents.filter(i => i.status === 'Closed').length;
  const underReviewCases = incidents.filter(i =>
    i.status !== 'Closed' &&
    (i.workflowStage ? i.workflowStage === 'Under Review' : i.status === 'Under Investigation')
  ).length;
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

      {/* KPI Cards Grid */}
      <div className="grid-cols-4">
        <div className="glass-card stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Security Cases</span>
            <AlertTriangle className="stat-icon primary" size={24} />
          </div>
          <div className="stat-value">{activeCases}</div>
          <div className="stat-footer">
            <span>Currently under active investigation</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <span className="stat-title">Under Review</span>
            <FileSearch className="stat-icon warning" size={24} />
          </div>
          <div className="stat-value">{underReviewCases}</div>
          <div className="stat-footer">
            <span>Preliminary review by coordinator</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <span className="stat-title">Resolved Cases</span>
            <CheckCircle className="stat-icon success" size={24} />
          </div>
          <div className="stat-value">{closedCases}</div>
          <div className="stat-footer">
            <span>Closed with outcome recorded</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <span className="stat-title">Total Value of Loss</span>
            <DollarSign className="stat-icon danger" size={24} />
          </div>
          <div className="stat-value">R {totalLoss.toLocaleString()}</div>
          <div className="stat-footer">
            <span className="stat-trend-down">Estimated replacement value</span>
          </div>
        </div>

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
