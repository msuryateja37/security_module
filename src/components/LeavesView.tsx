import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../security/roleAccess';
import type { LeaveBalance, LeaveDay } from '../types/leave';
import { LEAVE_STATUS_BADGE } from '../types/leave';
import { addDays, buildMonthGrid, isPublicHoliday, isWorkingDay, MONTH_NAMES } from '../utils/workdays';
import { CalendarDays, ChevronLeft, ChevronRight, Info, ListChecks, Plus, Send, X } from 'lucide-react';
import { useModal } from './NotificationModal';
import { Pagination } from './Pagination';

interface LeavesViewProps {
  currentUser: UserProfile;
}

// Day-cell colours come from the app badge palette (src/index.css .badge.*)
const DAY_COLORS: Record<string, { background: string; color: string; border: string }> = {
  Pending: { background: '#fef3c7', color: '#b45309', border: '#fde68a' },   // applied → yellow
  Approved: { background: '#dcfce7', color: '#15803d', border: '#bbf7d0' },  // approved → green
  Rejected: { background: '#fee2e2', color: '#b91c1c', border: '#fecaca' }   // rejected → red
};

// When one date carries several historical rows (e.g. re-requested after a
// rejection), the calendar shows the most significant one.
const STATUS_PRIORITY: Record<string, number> = { Approved: 3, Pending: 2, Rejected: 1 };

export const LeavesView: React.FC<LeavesViewProps> = ({ currentUser }) => {
  const { showAlert, showConfirm } = useModal();

  const [days, setDays] = useState<LeaveDay[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>({ total: 0, committed: 0, available: 0 });
  const [serverToday, setServerToday] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'calendar' | 'requests'>('calendar');
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [requestMode, setRequestMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const authHeaders = {
    'x-username': currentUser.username,
    'x-user-role': currentUser.role,
    'Content-Type': 'application/json'
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaves/mine', { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        setDays(json.data.days);
        setBalance(json.data.balance);
        setServerToday(json.data.today);
      }
    } catch (err) {
      console.error('Failed to load leave records:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  useEffect(() => {
    load();
  }, [load]);

  const tomorrow = addDays(serverToday, 1);

  // Most significant leave row per calendar date (for cell colouring)
  const dayByDate = useMemo(() => {
    const map = new Map<string, LeaveDay>();
    for (const day of days) {
      if (!STATUS_PRIORITY[day.status]) continue; // Revoked/Cancelled/Expired days show as free
      const existing = map.get(day.leaveDate);
      if (!existing || STATUS_PRIORITY[day.status] > STATUS_PRIORITY[existing.status]) {
        map.set(day.leaveDate, day);
      }
    }
    return map;
  }, [days]);

  // Batches for the "My Requests" screen, newest first
  const batches = useMemo(() => {
    const grouped = new Map<string, LeaveDay[]>();
    for (const day of days) {
      const group = grouped.get(day.batchId) || [];
      group.push(day);
      grouped.set(day.batchId, group);
    }
    return [...grouped.values()]
      .map(group => [...group].sort((a, b) => a.leaveDate.localeCompare(b.leaveDate)))
      .sort((a, b) => b[0].dateCreated.localeCompare(a[0].dateCreated));
  }, [days]);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const moveMonth = (delta: number) => {
    setCursor(prev => {
      const d = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };

  const toggleDate = (date: string) => {
    if (!requestMode) return;
    if (date < tomorrow) return; // leave starts from tomorrow onwards — never past dates
    if (!isWorkingDay(date)) return; // weekends & public holidays don't consume leave
    if (dayByDate.get(date) && ['Pending', 'Approved'].includes(dayByDate.get(date)!.status)) return;

    setSelectedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      if (prev.length >= balance.available) {
        showAlert(`You can select at most ${balance.available} day(s) — that is your available leave balance.`, 'Selection Limit', 'warning');
        return prev;
      }
      return [...prev, date].sort();
    });
  };

  const exitRequestMode = () => {
    setRequestMode(false);
    setSelectedDates([]);
    setReason('');
  };

  const submitRequest = async () => {
    if (selectedDates.length === 0) {
      showAlert('Select at least one working day on the calendar.', 'Nothing Selected', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ dates: selectedDates, reason })
      });
      const json = await res.json();
      if (json.success) {
        showAlert(
          `Your request for ${selectedDates.length} leave day(s) has been submitted to the Chief Security Director for approval.`,
          'Leave Request Submitted',
          'success'
        );
        exitRequestMode();
        load();
      } else {
        showAlert(json.error || json.message || 'Request failed.', 'Request Failed', 'warning');
      }
    } catch {
      showAlert('Request failed — server unreachable.', 'Request Failed', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // Once any approved day of a batch has started, the batch is locked
  const batchLockDate = (group: LeaveDay[]): string | null => {
    const approved = group.filter(d => d.status === 'Approved').map(d => d.leaveDate);
    return approved.length > 0 ? approved.reduce((a, b) => (a < b ? a : b)) : null;
  };

  const canCancel = (day: LeaveDay, group: LeaveDay[]): boolean => {
    if (day.status === 'Pending') return true;
    if (day.status !== 'Approved') return false;
    const lock = batchLockDate(group);
    return !lock || serverToday < lock;
  };

  const cancelDay = (day: LeaveDay) => {
    showConfirm({
      title: 'Cancel Leave Day',
      message: `Cancel your ${day.status.toLowerCase()} leave day on ${day.leaveDate}? The day returns to your balance and the Chief Security Director is notified.`,
      confirmText: 'Cancel Leave Day',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/leaves/days/${encodeURIComponent(day.id)}/cancel`, {
            method: 'PUT',
            headers: authHeaders
          });
          const json = await res.json();
          if (json.success) {
            showAlert(`Leave day ${day.leaveDate} cancelled.`, 'Leave Cancelled', 'success');
            load();
          } else {
            showAlert(json.error || json.message || 'Cancellation failed.', 'Operation Failed', 'warning');
          }
        } catch {
          showAlert('Cancellation failed — server unreachable.', 'Operation Failed', 'warning');
        }
      }
    });
  };

  const requestDisabled = balance.available < 1;

  /** Kept clickable when there is no balance so the user gets an explanation rather
      than an inert button (LEAVE-001). */
  const handleRequestLeaveClick = () => {
    if (requestDisabled) {
      showAlert(
        balance.total === 0
          ? 'You do not have a leave allocation yet. The Chief Security Director must set your annual leave days before you can submit a request.'
          : `All ${balance.total} of your allocated leave day(s) are already pending or approved. Cancel a pending day, or ask the Chief Security Director to review your allocation.`,
        'No Leave Days Available',
        'warning'
      );
      return;
    }
    setScreen('calendar');
    setRequestMode(true);
  };

  return (
    <div>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Top-left: My Requests toggle */}
        <div>
          <button
            className={`btn ${screen === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setScreen(screen === 'requests' ? 'calendar' : 'requests')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {screen === 'requests' ? <CalendarDays size={16} /> : <ListChecks size={16} />}
            {screen === 'requests' ? 'Back to Calendar' : 'My Requests'}
          </button>
        </div>

        <div style={{ textAlign: 'center', flexGrow: 1 }}>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Leave Management</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Request leave and track approvals — an acting coordinator covers your cases while you are away</p>
        </div>

        {/* Top-right: balance + Request Leave */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${balance.available > 0 ? 'success' : 'muted'}`} style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
            Leave available: {balance.available} / {balance.total}
          </span>
          <button
            className="btn btn-primary"
            disabled={requestMode}
            title={requestMode ? 'Select days on the calendar' : undefined}
            onClick={handleRequestLeaveClick}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: requestMode ? 0.55 : 1, cursor: requestMode ? 'not-allowed' : 'pointer' }}
          >
            <Plus size={16} /> Request Leave
          </button>
        </div>
      </div>

      {/* A disabled button with a tooltip reads as "nothing happened" — the reason a
          coordinator cannot request leave has to be on the page (LEAVE-001). */}
      {requestDisabled && !loading && (
        <div className="leave-blocked-note">
          <Info size={16} />
          <span>
            {balance.total === 0
              ? 'You have no leave allocation yet. The Chief Security Director sets your annual leave days before you can submit a request.'
              : `You have used all ${balance.total} of your allocated leave day(s) — ${balance.committed} are pending or approved. Cancel a pending day, or ask the Chief Security Director to review your allocation.`}
          </span>
        </div>
      )}

      {screen === 'calendar' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {requestMode && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)'
            }}>
              <strong style={{ color: '#b45309', fontSize: '0.85rem' }}>
                Select up to {balance.available} working day(s) from tomorrow onwards — {selectedDates.length} selected
              </strong>
              <input
                type="text"
                className="form-input"
                placeholder="Reason (optional, visible to the Chief Security Director only)"
                value={reason}
                maxLength={500}
                onChange={e => setReason(e.target.value)}
                style={{ flexGrow: 1, minWidth: '220px', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              />
              <button
                className="btn btn-primary"
                onClick={submitRequest}
                disabled={submitting || selectedDates.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
              >
                <Send size={14} /> {submitting ? 'Submitting…' : `Submit Request (${selectedDates.length})`}
              </button>
              <button className="btn btn-secondary" onClick={exitRequestMode} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}

          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => moveMonth(-1)} title="Previous month" style={{ padding: '0.35rem 0.6rem' }}>
              <ChevronLeft size={16} />
            </button>
            <h3 style={{ margin: 0 }}>{MONTH_NAMES[cursor.month]} {cursor.year}</h3>
            <button className="btn btn-secondary" onClick={() => moveMonth(1)} title="Next month" style={{ padding: '0.35rem 0.6rem' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Big calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => (
              <div key={label} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                {label}
              </div>
            ))}
            {cells.map(cell => {
              const leave = dayByDate.get(cell.date);
              const colors = leave ? DAY_COLORS[leave.status] : null;
              const nonWorking = !isWorkingDay(cell.date);
              const selected = selectedDates.includes(cell.date);
              const selectable = requestMode && cell.date >= tomorrow && !nonWorking &&
                !(leave && ['Pending', 'Approved'].includes(leave.status));
              const isToday = cell.date === serverToday;

              return (
                <div
                  key={cell.date}
                  onClick={() => toggleDate(cell.date)}
                  title={
                    leave ? `${leave.status} leave` :
                    isPublicHoliday(cell.date) ? 'Public holiday' :
                    nonWorking ? 'Weekend' :
                    selectable ? 'Click to select' : cell.date
                  }
                  style={{
                    minHeight: '76px',
                    borderRadius: 'var(--radius-sm)',
                    border: selected ? '2px solid var(--color-primary)' : `1px solid ${colors ? colors.border : 'var(--border-color, #e5e7eb)'}`,
                    background: selected ? 'rgba(0, 51, 38, 0.08)' : colors ? colors.background : nonWorking ? '#f3f4f6' : '#ffffff',
                    opacity: cell.inMonth ? 1 : 0.35,
                    cursor: selectable ? 'pointer' : 'default',
                    padding: '0.4rem',
                    position: 'relative',
                    outline: isToday ? '2px solid var(--color-accent)' : 'none',
                    outlineOffset: '-2px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: colors ? colors.color : nonWorking ? '#9ca3af' : 'var(--text-primary)' }}>
                    {parseInt(cell.date.slice(8), 10)}
                  </span>
                  {leave && (
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: colors!.color, marginTop: '0.25rem' }}>
                      {leave.status}
                    </div>
                  )}
                  {selected && (
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                      Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <span className="badge warning">Applied (awaiting decision)</span>
            <span className="badge success">Approved</span>
            <span className="badge danger">Rejected</span>
            <span className="badge muted">Weekend / public holiday</span>
          </div>
          {loading && <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>Loading leave records…</p>}
        </div>
      )}

      {screen === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {batches.length === 0 && !loading && (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <CalendarDays size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p>You have not requested any leave yet.</p>
            </div>
          )}
          {batches.slice((currentPage - 1) * 10, currentPage * 10).map(group => (
            <div key={group[0].batchId} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', paddingBottom: '0.6rem', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>
                    {group[0].leaveDate}{group.length > 1 ? ` — ${group[group.length - 1].leaveDate}` : ''} ({group.length} day{group.length > 1 ? 's' : ''})
                  </strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Requested {group[0].dateCreated.slice(0, 10)} · Ref {group[0].batchId}
                  </div>
                </div>
                {group[0].reason && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '40%' }}>
                    <strong>Reason:</strong> {group[0].reason}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {group.map(day => (
                  <div key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 600, minWidth: '92px' }}>{day.leaveDate}</span>
                    <span className={`badge ${LEAVE_STATUS_BADGE[day.status]}`}>{day.status}</span>
                    {day.substituteDisplayName && day.status === 'Approved' && (
                      <span style={{ color: 'var(--text-secondary)' }}>Acting coordinator: {day.substituteDisplayName}</span>
                    )}
                    {day.decidedBy && day.status !== 'Pending' && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                        by {day.decidedBy}{day.decidedAt ? ` on ${day.decidedAt.slice(0, 10)}` : ''}
                      </span>
                    )}
                    {day.decisionNote && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontStyle: 'italic' }}>“{day.decisionNote}”</span>
                    )}
                    {canCancel(day, group) && (
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', marginLeft: 'auto' }} onClick={() => cancelDay(day)}>
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Pagination currentPage={currentPage} totalItems={batches.length} itemsPerPage={10} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
};
