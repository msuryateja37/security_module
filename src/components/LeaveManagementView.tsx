import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../security/roleAccess';
import type { LeaveDay, SubstituteCandidate } from '../types/leave';
import { LEAVE_STATUS_BADGE } from '../types/leave';
import { CalendarCheck, CheckCircle2, ThumbsDown, ThumbsUp, UserCheck } from 'lucide-react';
import { useModal } from './NotificationModal';

interface LeaveManagementViewProps {
  currentUser: UserProfile;
}

type Batch = LeaveDay[];

const batchLockDate = (group: Batch): string | null => {
  const approved = group.filter(d => d.status === 'Approved').map(d => d.leaveDate);
  return approved.length > 0 ? approved.reduce((a, b) => (a < b ? a : b)) : null;
};

/** Pending-decision card: per-day approve/reject + mandatory substitute nomination. */
const PendingBatchCard: React.FC<{
  group: Batch;
  authHeaders: Record<string, string>;
  onDecided: () => void;
}> = ({ group, authHeaders, onDecided }) => {
  const { showAlert, showConfirm } = useModal();
  const pendingDays = group.filter(d => d.status === 'Pending');
  const [decisions, setDecisions] = useState<Record<string, 'approve' | 'reject'>>(
    () => Object.fromEntries(pendingDays.map(d => [d.id, 'approve']))
  );
  const [candidates, setCandidates] = useState<SubstituteCandidate[] | null>(null);
  const [substitute, setSubstitute] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/leaves/${encodeURIComponent(group[0].batchId)}/substitutes`, { headers: authHeaders })
      .then(res => res.json())
      .then(json => { if (json.success) setCandidates(json.data); })
      .catch(err => console.error('Failed to load substitutes:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group[0].batchId]);

  const approvals = pendingDays.filter(d => decisions[d.id] === 'approve');
  const approvedDates = approvals.map(d => d.leaveDate);
  const eligible = (candidates || []).map(c => ({
    ...c,
    blocked: c.conflictDates.some(d => approvedDates.includes(d))
  }));
  const needsSubstitute = approvals.length > 0;

  const submit = () => {
    if (needsSubstitute && !substitute) {
      showAlert('Nominate an employee to act as Security Coordinator before approving any day.', 'Substitute Required', 'warning');
      return;
    }
    const rejected = pendingDays.filter(d => decisions[d.id] === 'reject');
    showConfirm({
      title: 'Confirm Leave Decision',
      message: `Approve ${approvals.length} day(s)${approvals.length ? ` (${approvedDates.join(', ')})` : ''} and reject ${rejected.length} day(s) for ${group[0].ownerDisplayName || group[0].ownerId}?${needsSubstitute ? ` ${eligible.find(c => c.username === substitute)?.displayName || substitute} will act as coordinator on the approved days.` : ''}`,
      confirmText: 'Submit Decision',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const res = await fetch(`/api/leaves/${encodeURIComponent(group[0].batchId)}/decide`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({
              decisions: pendingDays.map(d => ({ dayId: d.id, action: decisions[d.id] })),
              substituteUsername: needsSubstitute ? substitute : undefined,
              note
            })
          });
          const json = await res.json();
          if (json.success) {
            showAlert('The decision has been recorded and the coordinator notified in-app and by email.', 'Leave Request Decided', 'success');
            onDecided();
          } else {
            showAlert(json.error || json.message || 'Decision failed.', 'Operation Failed', 'warning');
          }
        } catch {
          showAlert('Decision failed — server unreachable.', 'Operation Failed', 'warning');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  return (
    <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-color, #e5e7eb)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div>
          <strong style={{ fontSize: '0.95rem' }}>{group[0].ownerDisplayName || group[0].ownerId}</strong>
          <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {group[0].province} · requested {group[0].dateCreated.slice(0, 10)} · Ref {group[0].batchId}
          </span>
        </div>
        <span className="badge warning">{pendingDays.length} day(s) awaiting decision</span>
      </div>

      {group[0].reason && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          <strong>Reason:</strong> {group[0].reason}
        </p>
      )}

      {/* Per-day approve/reject — a 4-day request can be approved for 3 and rejected for 1 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
        {pendingDays.map(day => (
          <div key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem' }}>
            <span style={{ fontWeight: 600, minWidth: '92px' }}>{day.leaveDate}</span>
            <button
              className={`btn ${decisions[day.id] === 'approve' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDecisions(prev => ({ ...prev, [day.id]: 'approve' }))}
              style={{ padding: '0.25rem 0.7rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <ThumbsUp size={12} /> Approve
            </button>
            <button
              className={`btn ${decisions[day.id] === 'reject' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDecisions(prev => ({ ...prev, [day.id]: 'reject' }))}
              style={{
                padding: '0.25rem 0.7rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                ...(decisions[day.id] === 'reject' ? { background: '#b91c1c', borderColor: '#b91c1c' } : {})
              }}
            >
              <ThumbsDown size={12} /> Reject
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {needsSubstitute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <UserCheck size={16} color="var(--color-primary)" />
            <select
              className="form-input"
              value={substitute}
              onChange={e => setSubstitute(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', minWidth: '260px' }}
            >
              <option value="">Nominate acting coordinator ({group[0].province} employee)…</option>
              {eligible.map(c => (
                <option key={c.username} value={c.username} disabled={c.blocked}>
                  {c.displayName} — {c.office}{c.blocked ? ' (already covering these dates)' : ''}
                </option>
              ))}
            </select>
            {candidates !== null && eligible.length === 0 && (
              <span className="badge danger" style={{ fontSize: '0.68rem' }}>
                No eligible employee in {group[0].province} — reject or free up an employee first
              </span>
            )}
          </div>
        )}
        <input
          type="text"
          className="form-input"
          placeholder="Decision note (optional, shared with the coordinator)"
          value={note}
          maxLength={500}
          onChange={e => setNote(e.target.value)}
          style={{ flexGrow: 1, minWidth: '200px', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
        />
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={submitting}
          style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <CalendarCheck size={14} /> {submitting ? 'Submitting…' : 'Submit Decision'}
        </button>
      </div>
    </div>
  );
};

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({ currentUser }) => {
  const { showAlert, showConfirm } = useModal();
  const [days, setDays] = useState<LeaveDay[]>([]);
  const [serverToday, setServerToday] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'history'>('pending');

  const authHeaders = {
    'x-username': currentUser.username,
    'x-user-role': currentUser.role,
    'Content-Type': 'application/json'
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaves', { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        setDays(json.data.days);
        setServerToday(json.data.today);
      }
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  useEffect(() => {
    load();
  }, [load]);

  const batches = useMemo(() => {
    const grouped = new Map<string, Batch>();
    for (const day of days) {
      const group = grouped.get(day.batchId) || [];
      group.push(day);
      grouped.set(day.batchId, group);
    }
    return [...grouped.values()]
      .map(group => [...group].sort((a, b) => a.leaveDate.localeCompare(b.leaveDate)))
      .sort((a, b) => b[0].dateCreated.localeCompare(a[0].dateCreated));
  }, [days]);

  const pendingBatches = batches.filter(g => g.some(d => d.status === 'Pending'));
  const upcomingBatches = batches.filter(g =>
    !g.some(d => d.status === 'Pending') &&
    g.some(d => d.status === 'Approved' && d.leaveDate >= serverToday)
  );
  const historyBatches = batches.filter(g => !pendingBatches.includes(g) && !upcomingBatches.includes(g));

  const revokeDay = (day: LeaveDay) => {
    showConfirm({
      title: 'Revoke Approved Leave',
      message: `Revoke the approved leave of ${day.ownerDisplayName || day.ownerId} on ${day.leaveDate}? The coordinator and the nominated acting coordinator will be notified.`,
      confirmText: 'Revoke Leave Day',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/leaves/days/${encodeURIComponent(day.id)}/revoke`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({})
          });
          const json = await res.json();
          if (json.success) {
            showAlert(`Leave day ${day.leaveDate} revoked.`, 'Leave Revoked', 'success');
            load();
          } else {
            showAlert(json.error || json.message || 'Revocation failed.', 'Operation Failed', 'warning');
          }
        } catch {
          showAlert('Revocation failed — server unreachable.', 'Operation Failed', 'warning');
        }
      }
    });
  };

  const renderReadOnlyBatch = (group: Batch, allowRevoke: boolean) => {
    const lock = batchLockDate(group);
    const started = lock !== null && serverToday >= lock;
    const onLeaveToday = group.some(d => d.status === 'Approved' && d.leaveDate === serverToday);

    return (
      <div key={group[0].batchId} className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <div>
            <strong style={{ fontSize: '0.95rem' }}>{group[0].ownerDisplayName || group[0].ownerId}</strong>
            <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {group[0].province} · Ref {group[0].batchId}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {onLeaveToday && <span className="badge primary">On leave today</span>}
            {allowRevoke && started && <span className="badge muted">Locked — leave has started</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {group.map(day => (
            <div key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 600, minWidth: '92px' }}>{day.leaveDate}</span>
              <span className={`badge ${LEAVE_STATUS_BADGE[day.status]}`}>{day.status}</span>
              {day.substituteDisplayName && day.status === 'Approved' && (
                <span style={{ color: 'var(--text-secondary)' }}>Acting: {day.substituteDisplayName}</span>
              )}
              {day.decisionNote && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontStyle: 'italic' }}>“{day.decisionNote}”</span>
              )}
              {allowRevoke && day.status === 'Approved' && !started && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', marginLeft: 'auto' }}
                  onClick={() => revokeDay(day)}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Review coordinator leave requests, nominate acting coordinators, and manage approved leave</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
        <button onClick={() => setActiveTab('pending')} className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 'var(--radius-sm)' }}>
          Pending ({pendingBatches.length})
        </button>
        <button onClick={() => setActiveTab('upcoming')} className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 'var(--radius-sm)' }}>
          Approved &amp; Upcoming ({upcomingBatches.length})
        </button>
        <button onClick={() => setActiveTab('history')} className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 'var(--radius-sm)' }}>
          History ({historyBatches.length})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading leave requests…</p>}

        {activeTab === 'pending' && pendingBatches.map(group => (
          <PendingBatchCard key={group[0].batchId} group={group} authHeaders={authHeaders} onDecided={load} />
        ))}
        {activeTab === 'pending' && !loading && pendingBatches.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={36} style={{ color: 'green', opacity: 0.5, marginBottom: '0.5rem' }} />
            <p>No leave requests awaiting your decision.</p>
          </div>
        )}

        {activeTab === 'upcoming' && upcomingBatches.map(group => renderReadOnlyBatch(group, true))}
        {activeTab === 'upcoming' && !loading && upcomingBatches.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CalendarCheck size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <p>No approved upcoming leave.</p>
          </div>
        )}

        {activeTab === 'history' && historyBatches.map(group => renderReadOnlyBatch(group, false))}
        {activeTab === 'history' && !loading && historyBatches.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No historical leave records yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
