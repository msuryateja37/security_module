import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SecurityIncident } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, DollarSign, ArrowRight, FileSearch, FileText, Briefcase, Clock, ClipboardCheck, ArrowUpRight, Plus } from 'lucide-react';
import { PROVINCES } from '../data/mockData';
import { getCaseStageLabel, getStatusChipColors } from '../utils/statusChips';

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

    case 'deputy_director': {
      const awaitingMyReview = incidents.filter(i => !isCaseClosed(i) && i.workflowStage === 'Pending DD Review').length;
      const forwarded = incidents.filter(i => !isCaseClosed(i) && i.workflowStage === 'Pending Approval').length;
      return [
        { title: 'Awaiting My Review', icon: ClipboardCheck, iconClass: 'warning', value: String(awaitingMyReview), footer: 'Submissions awaiting your verification and recommendations' },
        { title: 'Forwarded to Director', icon: FileSearch, iconClass: 'primary', value: String(forwarded), footer: 'Reviewed cases awaiting the Chief Security Director' },
        { title: 'National Active Cases', icon: AlertTriangle, iconClass: 'primary', value: String(activeCases), footer: 'Open cases across all provinces' },
        { title: 'National Value of Loss', icon: DollarSign, iconClass: 'danger', value: `R ${totalLoss.toLocaleString()}`, footer: 'Estimated losses across all provinces' }
      ];
    }

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

// Single progress value 0→1 (~900ms, ease-out cubic) driving the KPI
// count-ups, bar heights, donut sweep and line reveal per the handoff.
// Restarts when the incident data arrives so the charts still animate
// when the server responds after mount.
const useChartProgress = (dataKey: number) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setProgress(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataKey]);
  return progress;
};

// Animate the numeric portion of a KPI value ("12" or "R 86 500") during mount.
const animatedKpiValue = (value: string, p: number): string => {
  const numeric = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric)) return value;
  const shown = Math.round(numeric * p);
  return value.startsWith('R') ? `R ${shown.toLocaleString()}` : String(shown);
};

const fmtRk = (n: number): string => {
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `R ${Math.round(n / 1000)}k`;
  return `R ${Math.round(n).toLocaleString()}`;
};

// Donut colors per handoff — loss by classification
const CLASSIFICATION_COLORS: Record<string, string> = {
  'Unclassified': '#2FB98A',
  'Restricted': '#157A5B',
  'Confidential': '#0B4635',
  'Secret': '#C89B3C',
  'Top Secret': '#B4432D'
};

// Status distribution series colors per handoff
const STATUS_DIST_COLORS: Record<string, string> = {
  'Resolved': '#2FB98A',
  'Under Review': '#D6A331',
  'Submitted': '#64748B',
  'Under Investigation': '#157A5B',
  'Escalated': '#C2543B'
};

// Bucket a case into the 5 status-distribution series.
const statusBucket = (i: SecurityIncident): keyof typeof STATUS_DIST_COLORS => {
  if (isCaseClosed(i)) return 'Resolved';
  const stage = i.workflowStage;
  if (stage === 'Escalated') return 'Escalated';
  if (stage === 'Under Review') return 'Under Review';
  if (stage === 'Investigation' || stage === 'Pending Approval' || stage === 'Approved') return 'Under Investigation';
  if (stage === 'Submitted') return 'Submitted';
  if (i.status === 'Under Investigation' || i.status === 'SAPS Case') return 'Under Investigation';
  return 'Submitted';
};

export const DashboardView: React.FC<DashboardViewProps> = ({ incidents, currentUser, onNavigate }) => {
  // All KPIs are computed from the incidents the server returned for this user
  // (already scoped to their province/role) — no seeded statistics.
  const kpis = getKpisForRole(currentUser, incidents);
  const totalLoss = incidents.reduce((sum, i) => sum + i.lossValue, 0);
  const sapsReferrals = incidents.filter(i => i.reportedToSapsSsa === 'Yes' || i.status === 'SAPS Case').length;
  const progress = useChartProgress(incidents.length);

  // Employees / SysAdmins track their own incidents ("Track My Incidents");
  // other roles review the full register.
  const casesView = currentUser.role === 'employee' || currentUser.role === 'system_administrator' ? 'my_cases' : 'register';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = currentUser.displayName.split(' ')[0];

  // Province distribution for the bar chart
  const provinceCounts = PROVINCES.map(p => ({
    province: p,
    count: incidents.filter(i => i.province === p).length
  }));
  const maxProvinceCount = Math.max(...provinceCounts.map(c => c.count), 1);
  const topProvince = provinceCounts.reduce((best, c) => (c.count > best.count ? c : best), provinceCounts[0]);

  // Loss by classification (donut)
  const classificationLosses: Record<string, number> = {
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

  const DONUT_R = 70;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  let donutAcc = 0;
  const donutSegs = Object.entries(classificationLosses).map(([label, value]) => {
    const frac = totalLoss > 0 ? value / totalLoss : 0;
    const len = Math.max(0, frac * DONUT_C * progress - 3);
    const seg = {
      label,
      value,
      color: CLASSIFICATION_COLORS[label],
      pct: totalLoss > 0 ? `${Math.round(frac * 100)}%` : '0%',
      dash: `${len.toFixed(1)} ${(DONUT_C - len).toFixed(1)}`,
      offset: (-donutAcc * DONUT_C).toFixed(1)
    };
    donutAcc += frac;
    return seg;
  });

  // Incident trend — reported incidents per month, last 12 months
  const now = new Date();
  const trendMonths = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    return {
      label: d.toLocaleDateString('en-ZA', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth()
    };
  });
  const trendCounts = trendMonths.map(m =>
    incidents.filter(i => {
      const d = new Date(i.dateTime);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length
  );
  const maxTrend = Math.max(...trendCounts, 1);
  const trendPts = trendCounts.map((v, i) => [
    i * (560 / 11),
    185 - (v / maxTrend) * 165 * progress
  ] as const);
  const trendPath = 'M' + trendPts.map(pt => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' L');
  const trendArea = `${trendPath} L560 200 L0 200 Z`;
  const half = Math.floor(trendCounts.length / 2);
  const firstHalf = trendCounts.slice(0, half).reduce((a, b) => a + b, 0);
  const secondHalf = trendCounts.slice(half).reduce((a, b) => a + b, 0);
  const trendDeltaPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : (secondHalf > 0 ? 100 : 0);

  // Case status distribution (stacked bar)
  const statusCounts: Record<string, number> = { 'Resolved': 0, 'Under Review': 0, 'Submitted': 0, 'Under Investigation': 0, 'Escalated': 0 };
  incidents.forEach(i => { statusCounts[statusBucket(i)] += 1; });
  const statusTotal = incidents.length;

  const recentIncidents = [...incidents]
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    .slice(0, 5);

  const tableCols = '1.2fr 1.8fr 1.2fr 0.9fr 0.9fr 0.8fr 1fr 1.1fr';

  return (
    <div className="screen-fade-up">
      {/* Greeting row */}
      <div className="dash-greeting-row">
        <div>
          <div className="dash-greeting-title">{greeting}, {firstName}</div>
          <div className="dash-greeting-sub">Security overview · {today}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" style={{ padding: '12px 20px', fontSize: '14px' }} onClick={() => onNavigate('report')}>
          <Plus size={16} strokeWidth={2.5} /> Report Incident
        </button>
      </div>

      {/* KPI Cards Grid — personalized per role (FR-029) */}
      <div className="grid-cols-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div className="stat-card" key={kpi.title}>
              <div className="stat-header">
                <span className="stat-title">{kpi.title}</span>
                <Icon className={`stat-icon ${kpi.iconClass}`} size={30} />
              </div>
              <div className="stat-value">{animatedKpiValue(kpi.value, progress)}</div>
              <div className="stat-footer">
                <span>{kpi.footer}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 1 — province bars + loss donut */}
      <div className="grid-dashboard">
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <div className="chart-card-title">Security Incidents by Province</div>
            <div style={{ flex: 1 }} />
            <div className="chart-kicker">Last 12 months</div>
          </div>
          <div className="chart-card-sub">
            {topProvince.count > 0
              ? `${topProvince.province} accounts for the highest volume of reported incidents`
              : 'No incidents recorded for your scope yet'}
          </div>
          <div className="prov-bars">
            {provinceCounts.map(item => (
              <div className="prov-bar-col" key={item.province} title={`${item.province}: ${item.count} incident${item.count === 1 ? '' : 's'}`}>
                <div className="prov-bar-value">{item.count}</div>
                <div className="prov-bar-track">
                  <div
                    className="prov-bar-fill"
                    style={{ height: `${((item.count / maxProvinceCount) * 100 * progress).toFixed(1)}%` }}
                  />
                </div>
                <div className="prov-bar-label">
                  {item.province.length > 9 ? `${item.province.slice(0, 8)}…` : item.province}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chart-card-title">Loss Value by Classification</div>
          <div className="chart-card-sub">Total estimated loss across cases</div>
          <div className="donut-wrap">
            <svg width="176" height="176" viewBox="0 0 176 176">
              <circle cx="88" cy="88" r={DONUT_R} fill="none" stroke="#EEF3F0" strokeWidth="22" />
              {donutSegs.filter(d => d.value > 0).map(d => (
                <circle
                  key={d.label}
                  className="donut-seg"
                  cx="88" cy="88" r={DONUT_R}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="22"
                  strokeDasharray={d.dash}
                  strokeDashoffset={d.offset}
                  transform="rotate(-90 88 88)"
                />
              ))}
            </svg>
            <div className="donut-center">
              <div className="lbl">TOTAL LOSS</div>
              <div className="val">{fmtRk(totalLoss * progress)}</div>
            </div>
          </div>
          <div className="legend-rows">
            {donutSegs.map(d => (
              <div className="legend-row" key={d.label}>
                <span className="legend-swatch" style={{ background: d.color }} />
                <span className="legend-label">{d.label}</span>
                <span className="legend-amount">{fmtRk(d.value)}</span>
                <span className="legend-pct">{d.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 — trend line + status distribution */}
      <div className="grid-dashboard">
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <div className="chart-card-title">Incident Trend</div>
              <div className="chart-card-sub">Monthly reported incidents in your scope</div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="trend-badge">
              <TrendingUp size={14} strokeWidth={2.5} />
              <span>{trendDeltaPct >= 0 ? '+' : ''}{trendDeltaPct}% vs previous 6 months</span>
            </div>
          </div>
          <svg width="100%" height="200" viewBox="0 0 560 200" preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2FB98A" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2FB98A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={trendArea} fill="url(#trendFill)" />
            <path d={trendPath} fill="none" stroke="#157A5B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {trendPts.map((pt, i) => (
              <circle key={i} cx={pt[0].toFixed(1)} cy={pt[1].toFixed(1)} r="4.5" fill="#FFFFFF" stroke="#157A5B" strokeWidth="2.5">
                <title>{`${trendMonths[i].label}: ${trendCounts[i]} incident${trendCounts[i] === 1 ? '' : 's'}`}</title>
              </circle>
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px 0' }}>
            {trendMonths.map((m, i) => (
              <span key={i} style={{ fontSize: '10.5px', fontWeight: 600, color: '#8A978F' }}>{m.label}</span>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chart-card-title">Case Status Distribution</div>
          <div className="chart-card-sub" style={{ marginBottom: '18px' }}>
            {statusTotal > 0 ? `All ${statusTotal} active & closed cases` : 'No cases recorded yet'}
          </div>
          <div className="status-stack">
            {Object.entries(statusCounts).filter(([, count]) => count > 0).map(([label, count]) => (
              <div
                key={label}
                className="status-stack-seg"
                title={`${label}: ${count}`}
                style={{
                  width: `${statusTotal > 0 ? ((count / statusTotal) * 100 * progress).toFixed(1) : 0}%`,
                  background: STATUS_DIST_COLORS[label]
                }}
              />
            ))}
          </div>
          <div className="legend-rows" style={{ gap: '10px' }}>
            {Object.entries(statusCounts).map(([label, count]) => (
              <div className="legend-row" key={label} style={{ padding: '3px 8px' }}>
                <span className="legend-swatch round" style={{ background: STATUS_DIST_COLORS[label] }} />
                <span className="legend-label">{label}</span>
                <span className="legend-amount" style={{ fontSize: '13px' }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="saps-inset">
            <div>
              <div className="lbl">SAPS / SSA REFERRALS</div>
              <div className="val">{sapsReferrals} {sapsReferrals === 1 ? 'Case' : 'Cases'} Reported</div>
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn-outline-green fill-hover" onClick={() => onNavigate(casesView)} style={{ borderColor: 'var(--color-primary)', padding: '8px 14px', fontSize: '12.5px' }}>
              Register <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent incidents */}
      <div className="list-card">
        <div className="list-card-header">
          <div className="chart-card-title">Recent Security Incidents</div>
          <div style={{ flex: 1 }} />
          <button className="btn-outline-green" onClick={() => onNavigate(casesView)}>
            View All Register Cases <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
        <div className="list-grid-head" style={{ gridTemplateColumns: tableCols }}>
          <div>Ref No.</div><div>Description</div><div>Place</div><div>Province</div><div>Date</div><div>Loss</div><div>Classification</div><div>Status</div>
        </div>
        {recentIncidents.map(inc => {
          const stage = getCaseStageLabel(inc);
          return (
            <div
              key={inc.id}
              className="list-grid-row"
              style={{ gridTemplateColumns: tableCols }}
              onClick={() => onNavigate(casesView)}
            >
              <div className="cell-ref">{inc.refNo}</div>
              <div className="cell-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.natureOfLoss}>
                {inc.natureOfLoss}
              </div>
              <div className="cell-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.place}>
                {inc.place}
              </div>
              <div className="cell-muted">{inc.province}</div>
              <div className="cell-muted">{new Date(inc.dateTime).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div className="cell-strong">R {inc.lossValue.toLocaleString()}</div>
              <div><span className="chip-neutral">{inc.classification}</span></div>
              <div><span className="chip-status" style={getStatusChipColors(stage)}>{stage}</span></div>
            </div>
          );
        })}
        {recentIncidents.length === 0 && (
          <div className="list-empty">No security incidents registered.</div>
        )}
      </div>
    </div>
  );
};
