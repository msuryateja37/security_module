import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  PlusCircle,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import type { UserProfile } from '../security/roleAccess';
import { Pagination } from './Pagination';

interface CoordinatorStats {
  province: string;
  openInProvince: number;
  pendingAssignment: number;
  slaBreaches: number;
  escalated: number;
  inProgress: number;
  closed: number;
  total: number;
  severityDistribution: { urgent: number; high: number; medium: number; low: number };
  recentIncidents: RecentIncident[];
  assignInvestigatorsCount: number;
  slaEscalationsCount: number;
}

interface RecentIncident {
  id: string;
  refNo: string;
  reportedBy: string;
  place: string;
  province: string;
  incidentType: string;
  classification: string;
  status: string;
  workflowStage?: string;
  dateTime: string;
  assignedInvestigator?: string;
  slaInfo?: { status: string };
}

interface CoordinatorDashboardViewProps {
  currentUser: UserProfile;
  onNavigate: (view: string) => void;
}

const authFetch = (url: string, user: UserProfile) =>
  fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-username': user.username,
      'x-user-role': user.role,
    },
  });

// ── Severity badge helpers ─────────────────────────────────────────────────
const SEVERITY_LABEL: Record<string, string> = {
  'Top Secret': 'Urgent',
  'Secret': 'High',
  'Confidential': 'Medium',
  'Restricted': 'Medium',
  'Unclassified': 'Low',
};

const getSeverityLabel = (classification: string) =>
  SEVERITY_LABEL[classification] || 'Low';

const getSeverityClass = (classification: string) => {
  const label = getSeverityLabel(classification);
  if (label === 'Urgent' || label === 'High') return 'coord-badge coord-badge--high';
  if (label === 'Medium') return 'coord-badge coord-badge--medium';
  return 'coord-badge coord-badge--low';
};

const getStatusClass = (status: string) => {
  if (status === 'Closed') return 'coord-badge coord-badge--closed';
  if (status === 'Under Investigation') return 'coord-badge coord-badge--open';
  return 'coord-badge coord-badge--open';
};

// ── Animated counter ───────────────────────────────────────────────────────
const useCount = (target: number, duration = 700) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};

// ── KPI stat card ─────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = ({ label, value, icon: Icon, color, bg }) => {
  const animated = useCount(value);
  return (
    <div className="coord-stat-card">
      <div className="coord-stat-icon-wrap" style={{ background: bg, color }}>
        <Icon size={18} />
      </div>
      <div className="coord-stat-body">
        <span className="coord-stat-label">{label}</span>
        <span className="coord-stat-value" style={{ color }}>
          {animated}
        </span>
      </div>
    </div>
  );
};

// ── Bar chart ─────────────────────────────────────────────────────────────
const SeverityChart: React.FC<{
  data: { urgent: number; high: number; medium: number; low: number };
  province: string;
}> = ({ data, province }) => {
  const max = Math.max(...Object.values(data), 1);
  const bars = [
    { key: 'urgent', label: 'urgent', color: '#B4432D', value: data.urgent },
    { key: 'high', label: 'high', color: '#6C3D1B', value: data.high },
    { key: 'medium', label: 'medium', color: '#6C3D1B', value: data.medium },
    { key: 'low', label: 'low', color: '#D6A331', value: data.low },
  ];

  // Y axis: always baselined at 0, with a tick *step* chosen so the labels fit the
  // fixed-height axis column. Emitting one tick per unit (the old behaviour) overflowed
  // the 140px body once counts passed ~10, which pushed the low labels out of view and
  // desynced the axis from the bars (DASH-001).
  const TARGET_TICKS = 5;
  const rawStep = max / (TARGET_TICKS - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
  // Counts are whole numbers, so drop any candidate that would produce fractional ticks.
  const candidates = [1, 2, 2.5, 5, 10]
    .map(m => m * magnitude)
    .filter(Number.isInteger);
  const step = candidates.find(s => s >= rawStep) ?? 10 * magnitude;
  const yMax = step * (TARGET_TICKS - 1);
  const ticks = Array.from({ length: TARGET_TICKS }, (_, i) => yMax - i * step);

  return (
    <div className="coord-chart-card">
      <div className="coord-chart-header">
        <div>
          <h3 className="coord-chart-title">Severity distribution — {province}</h3>
          <p className="coord-chart-sub">Provincial breakdown by classification</p>
        </div>
      </div>

      <div className="coord-chart-body">
        {/* Y axis */}
        <div className="coord-chart-yaxis">
          {ticks.map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {/* Bars */}
        <div className="coord-chart-bars">
          {bars.map(bar => {
            const heightPct = max === 0 ? 0 : (bar.value / yMax) * 100;
            return (
              <div key={bar.key} className="coord-chart-bar-col">
                <div className="coord-chart-bar-track">
                  <div
                    className="coord-chart-bar-fill"
                    style={{
                      height: `${heightPct}%`,
                      background: bar.color,
                    }}
                    title={`${bar.value}`}
                  />
                </div>
                <span className="coord-chart-bar-label">{bar.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Coordinator Actions panel ─────────────────────────────────────────────
const ActionItem: React.FC<{
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: () => void;
}> = ({ icon: Icon, label, count, onClick }) => (
  <button className="coord-action-item" onClick={onClick}>
    <Icon size={16} className="coord-action-icon" />
    <span className="coord-action-label">
      {label}
      {count !== undefined && (
        <span className="coord-action-count">({count})</span>
      )}
    </span>
    <ArrowUpRight size={14} className="coord-action-arrow" />
  </button>
);

// ── Main Component ─────────────────────────────────────────────────────────
export const CoordinatorDashboardView: React.FC<CoordinatorDashboardViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [stats, setStats] = useState<CoordinatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const hasFetched = useRef(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/dashboard/summary', currentUser);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      } else {
        setError(json.message || 'Failed to load dashboard');
      }
    } catch (e) {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      loadStats();
    }
  }, [loadStats]);

  if (loading) {
    return (
      <div className="coord-loading">
        <div className="coord-spinner" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="coord-error">
        <AlertTriangle size={20} />
        <span>{error || 'No data available.'}</span>
        <button className="btn btn-secondary" onClick={loadStats}>Retry</button>
      </div>
    );
  }

  const province = stats.province || currentUser.province || 'Gauteng';

  return (
    <div className="coord-page screen-fade-up">

      {/* ── Header banner ──────────────────────────────────────────────── */}
      <div className="coord-header">
        <div className="coord-header-left">
          <h1 className="coord-header-title">Dashboard</h1>
          <p className="coord-header-sub">
            DLRRD Security Management Services
          </p>
        </div>
        <div className="coord-header-actions">
          <button
            className="coord-btn coord-btn--outline"
            onClick={() => onNavigate('register')}
          >
            View all Incidents
          </button>
          <button
            className="coord-btn coord-btn--primary"
            onClick={() => onNavigate('report')}
          >
            <PlusCircle size={15} />
            Report Incident
          </button>
        </div>
      </div>

      {/* ── BTO Banner ─────────────────────────────────────────────────── */}
      <div className="coord-bto-banner">
        <div className="coord-bto-text">
          <p className="coord-bto-title">Back to Office Report</p>
          <p className="coord-bto-sub">Post meeting/assessment/event report for record and follow-up.</p>
        </div>
      </div>

      {/* ── KPI row 1 ─────────────────────────────────────────────────── */}
      <div className="coord-kpi-grid">
        <StatCard
          label={`OPEN IN ${province.toUpperCase()}`}
          value={stats.openInProvince}
          icon={Shield}
          color="#6C3D1B"
          bg="rgba(108,61,27,0.1)"
        />
        <StatCard
          label="PENDING ASSIGNMENT"
          value={stats.pendingAssignment}
          icon={Clock}
          color="#D6A331"
          bg="rgba(214,163,49,0.12)"
        />
        <StatCard
          label="SLA BREACHES"
          value={stats.slaBreaches}
          icon={AlertTriangle}
          color="#B4432D"
          bg="rgba(180,67,45,0.1)"
        />
        <StatCard
          label="ESCALATED"
          value={stats.escalated}
          icon={Zap}
          color="#B4432D"
          bg="rgba(180,67,45,0.08)"
        />
      </div>

      {/* ── KPI row 2 ─────────────────────────────────────────────────── */}
      <div className="coord-kpi-grid coord-kpi-grid--3">
        <StatCard
          label="IN PROGRESS"
          value={stats.inProgress}
          icon={Clock}
          color="#D6A331"
          bg="rgba(214,163,49,0.12)"
        />
        <StatCard
          label="CLOSED"
          value={stats.closed}
          icon={CheckCircle2}
          color="#15803d"
          bg="rgba(21,128,61,0.1)"
        />
        <StatCard
          label="TOTAL"
          value={stats.total}
          icon={ClipboardList}
          color="#6C3D1B"
          bg="rgba(108,61,27,0.1)"
        />
      </div>

      {/* ── Chart + Actions ──────────────────────────────────────────── */}
      <div className="coord-mid-row">
        {/* Severity chart */}
        <SeverityChart data={stats.severityDistribution} province={province} />

        {/* Coordinator Actions */}
        <div className="coord-actions-card">
          <h3 className="coord-actions-title">Coordinator Actions</h3>
          <div className="coord-actions-list">
            <ActionItem
              icon={Users}
              label="Assign investigators"
              count={stats.assignInvestigatorsCount}
              onClick={() => onNavigate('my_cases')}
            />
            <ActionItem
              icon={AlertTriangle}
              label="SLA & escalations"
              count={stats.slaEscalationsCount}
              onClick={() => onNavigate('my_cases')}
            />
            <ActionItem
              icon={ClipboardList}
              label="Conduct TRA checklist"
              onClick={() => onNavigate('tra_checklist')}
            />
            <ActionItem
              icon={FileText}
              label="Back-to-Office report"
              onClick={() => onNavigate('bto_report')}
            />
            <ActionItem
              icon={MapPin}
              label={`Incidents in ${province}`}
              onClick={() => onNavigate('my_cases')}
            />
          </div>
        </div>
      </div>

      {/* ── Recent Incidents ──────────────────────────────────────────── */}
      <div className="coord-table-card">
        <div className="coord-table-header">
          <div>
            <h3 className="coord-table-title">Recent Incident — {province.toUpperCase()}</h3>
            <p className="coord-table-sub">Most Recent Activity</p>
          </div>
          <button
            className="coord-btn coord-btn--ghost"
            onClick={() => onNavigate('my_cases')}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table compact">
            <thead>
              {/* No selection column: this card is a read-only recent-activity summary and
                  the checkboxes were wired to nothing. Bulk actions live on Case Management,
                  reached via "View all" (DASH-003). */}
              <tr>
                <th>Ref #</th>
                <th>Submitted by</th>
                <th>Place</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentIncidents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No recent incidents for {province}.
                  </td>
                </tr>
              )}
              {(stats.recentIncidents || []).slice((currentPage - 1) * 10, currentPage * 10).map(inc => (
                <tr
                  key={inc.id}
                  className="coord-table-row"
                  onClick={() => onNavigate(`case:${inc.id}`)}
                >
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {inc.refNo}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{inc.reportedBy}</td>
                  <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {inc.place}
                  </td>
                  <td>
                    {/* Long official incident types are CSS-truncated — expose the full
                        value on hover so it stays readable. */}
                    <span className="coord-badge coord-badge--type" title={inc.incidentType}>
                      {inc.incidentType}
                    </span>
                  </td>
                  <td>
                    <span className={getSeverityClass(inc.classification)}>
                      {getSeverityLabel(inc.classification)}
                    </span>
                  </td>
                  <td>
                    <span className={getStatusClass(inc.status)}>
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={(stats.recentIncidents || []).length}
          itemsPerPage={10}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
