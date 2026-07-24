import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CaseAttachment, CaseComment, CaseEvent, SecurityIncident } from '../types/security';
import { CLOSURE_OUTCOMES } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { ROLE_LABELS } from '../security/roleAccess';
import {
  ArrowLeft, CalendarClock, CheckCircle2, ClipboardCheck, Clock, CornerDownRight, Download,
  FileText, Loader2, MessageSquare, Paperclip, Search, Send, ShieldAlert, UploadCloud, UserCheck, Undo2, Users, X
} from 'lucide-react';
import { useModal } from './NotificationModal';
import { useBreadcrumbTail } from './Breadcrumbs';

// The full case file — opened by clicking a case anywhere in the app (#/case/<id>).
// Shows the incident record, workflow timeline, attachments and the actions the
// current user's role may take at the case's current workflow stage.

interface AssignableCoordinator {
  username: string;
  displayName: string;
  province: string;
  office?: string | null;
}

interface CaseDetailViewProps {
  incidentId: string;
  currentUser: UserProfile;
  onBack: () => void;
  /** Called after any workflow action so the app-level incident list refreshes. */
  onChanged: () => void;
}

interface CaseFile {
  incident: SecurityIncident;
  attachments: CaseAttachment[];
  events: CaseEvent[];
  comments: CaseComment[];
}

interface Investigator {
  username: string;
  displayName: string;
  office: string;
}

const STAGE_BADGE: Record<string, string> = {
  'Submitted': 'danger',
  'Under Review': 'warning',
  'Escalated': 'danger',
  'Investigation': 'warning',
  'Pending DD Review': 'warning',
  'Pending Approval': 'primary',
  'Approved': 'primary',
  'Closed': 'success'
};

const EVENT_LABEL: Record<string, string> = {
  SUBMITTED: 'Incident submitted',
  REVIEW_STARTED: 'Review started',
  PRELIMINARY_FINDINGS: 'Preliminary findings captured',
  ESCALATED: 'Escalated to national office',
  INVESTIGATOR_ASSIGNED: 'Investigator assigned',
  EXTENSION_REQUESTED: 'Time extension requested',
  EXTENSION_GRANTED: 'Time extension granted',
  EXTENSION_DENIED: 'Time extension denied',
  FINDINGS_SUBMITTED: 'Findings submitted for review',
  SUBMITTED_TO_DD: 'Submitted to the Deputy Director',
  DD_REVIEWED: 'Deputy Director recommendation recorded',
  RETURNED: 'Case returned for further work',
  APPROVED: 'Investigation approved',
  CLOSED: 'Case closed',
  ATTACHMENT_ADDED: 'Document uploaded'
};

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.txt,.csv,.rtf,.msg,.eml,.zip,.mp4,.mov,.mp3,.wav';

const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDateTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-ZA', { dateStyle: 'medium' });
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({ incidentId, currentUser, onBack, onChanged }) => {
  const { showAlert, showConfirm } = useModal();
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Role action inputs
  const [preliminaryText, setPreliminaryText] = useState('');
  const [findingsText, setFindingsText] = useState('');
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [selectedInvestigator, setSelectedInvestigator] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closureOutcome, setClosureOutcome] = useState<string>('Closed');
  const [closureReport, setClosureReport] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Deputy Director review chain (v2)
  const [requestedOutcome, setRequestedOutcome] = useState<'close' | 'investigate'>('close');
  const [ddRecommendationText, setDdRecommendationText] = useState('');

  // Case discussion thread
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Director / Deputy Director: assign an unassigned incident to a coordinator
  const [showAssignCoordForm, setShowAssignCoordForm] = useState(false);
  const [assignableCoords, setAssignableCoords] = useState<{
    recommended: AssignableCoordinator[];
    others: AssignableCoordinator[];
  } | null>(null);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState('');

  // Investigation time-extension request / decision
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDecisionNote, setExtensionDecisionNote] = useState('');

  const authHeaders: Record<string, string> = useMemo(() => ({
    'x-username': currentUser.username,
    'x-user-role': currentUser.role
  }), [currentUser]);

  const loadCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}`, { headers: authHeaders });
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error || json.message || 'Failed to load the case file');
        return;
      }
      const data = json.data as CaseFile;
      setCaseFile(data);
      setPreliminaryText(prev => prev || data.incident.preliminaryFindings || '');
      setFindingsText(prev => prev || data.incident.investigationFindings || '');
      setLoadError(null);
    } catch {
      setLoadError('Failed to load the case file');
    }
  }, [incidentId, authHeaders]);

  useEffect(() => { loadCase(); }, [loadCase]);

  const incident = caseFile?.incident;
  useBreadcrumbTail(incident?.refNo || 'Case File');
  const stage = (incident?.workflowStage as string) || 'Submitted';
  const isClosed = stage === 'Closed' || incident?.status === 'Closed';

  const isDirector = currentUser.role === 'security_director';
  const isDeputyDirector = currentUser.role === 'deputy_director';
  // A coordinator explicitly assigned by a Director/Deputy Director owns the case even
  // if it sits in another province (mirrors the server predicate).
  const isCoordinatorForCase = !!incident &&
    currentUser.role === 'security_coordinator' &&
    (incident.province === currentUser.province || incident.responsiblePerson === currentUser.displayName) &&
    (!incident.responsiblePerson || incident.responsiblePerson === 'Unassigned' || incident.responsiblePerson === currentUser.displayName);
  // Accepting a case (or "Assign to Me") sets the coordinator as responsiblePerson;
  // until then the coordinator may only accept — no findings, escalation or closure.
  const coordinatorHasAccepted = isCoordinatorForCase && incident.responsiblePerson === currentUser.displayName;
  const isAssignedInvestigator = !!incident &&
    currentUser.role === 'chief_security_investigator' &&
    (incident.responsiblePerson === currentUser.displayName || incident.assignedInvestigator === currentUser.displayName);
  const isReporter = !!incident &&
    (incident.ownerId === currentUser.username || incident.contactDetails === currentUser.email || incident.reportedBy === currentUser.displayName);

  const canUpload = !isClosed && (isDirector || isCoordinatorForCase || isAssignedInvestigator || isReporter);

  // Director / Deputy Director may route an unassigned, still-Submitted incident to a coordinator
  const canAssignCoordinator = !!incident &&
    (isDirector || isDeputyDirector) &&
    (incident.workflowStage || 'Submitted') === 'Submitted' &&
    (!incident.responsiblePerson || incident.responsiblePerson === 'Unassigned');

  // Investigation time extension. The requester's window must be at risk or overdue:
  // the coordinator's 7-day window (Under Review) or the investigator's 14-day clock
  // (Investigation). The server re-checks this gate.
  const sla = incident?.slaInfo;
  const extensionStatus = incident?.extensionStatus || '';
  const extensionPending = extensionStatus === 'Pending';
  const coordWindowStatus = sla?.coordinatorWindow?.status;
  const investigatorWindowAtRisk = !!sla && (sla.daysRemaining < 0 || sla.daysRemaining <= Math.ceil((sla.targetDays || 14) * 0.25));
  const myWindowNeedsExtension = !isClosed && !extensionPending && (
    (coordinatorHasAccepted && stage === 'Under Review' && (coordWindowStatus === 'At Risk' || coordWindowStatus === 'Overdue')) ||
    (isAssignedInvestigator && stage === 'Investigation' && investigatorWindowAtRisk)
  );
  const canDecideExtension = !isClosed && extensionPending && (isDirector || isDeputyDirector);

  // Load the recommended/other coordinator lists when the assign drawer opens
  useEffect(() => {
    if (!showAssignCoordForm || !incident) return;
    setLoadingCoords(true);
    setAssignableCoords(null);
    fetch(`/api/incidents/${encodeURIComponent(incidentId)}/assignable-coordinators`, { headers: authHeaders })
      .then(res => res.json())
      .then(json => { if (json.success) setAssignableCoords({ recommended: json.data.recommended, others: json.data.others }); })
      .catch(() => { /* list stays empty; the drawer shows the empty state */ })
      .finally(() => setLoadingCoords(false));
  }, [showAssignCoordForm, incident, incidentId, authHeaders]);

  // Load the assignment dropdown only when the director can actually assign
  useEffect(() => {
    if (!isDirector || !incident || !['Escalated', 'Investigation', 'Pending Approval'].includes(stage)) return;
    fetch('/api/investigators', { headers: authHeaders })
      .then(res => res.json())
      .then(json => { if (json.success) setInvestigators(json.data); })
      .catch(() => { /* dropdown stays empty */ });
  }, [isDirector, stage, incident, authHeaders]);

  const runAction = async (
    actionKey: string,
    url: string,
    method: 'POST' | 'PUT',
    body: object,
    successMessage: string
  ): Promise<boolean> => {
    setBusyAction(actionKey);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!json.success) {
        showAlert(json.error || json.message || 'The action could not be completed.', 'Action Failed', 'danger');
        return false;
      }
      await loadCase();
      onChanged();
      showAlert(successMessage, 'Success', 'success');
      return true;
    } catch {
      showAlert('The action could not be completed.', 'Action Failed', 'danger');
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleUploadFiles = async (list: FileList | null, category: string) => {
    if (!list || list.length === 0) return;
    setIsUploading(true);
    let uploaded = 0;
    for (const file of Array.from(list)) {
      if (file.size > 15 * 1024 * 1024) {
        showAlert(`"${file.name}" exceeds the 15 MB per-file limit and was skipped.`, 'File Too Large', 'warning');
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: dataUrl, category })
        });
        const json = await res.json();
        if (json.success) uploaded++;
        else showAlert(`"${file.name}" could not be uploaded: ${json.error || json.message}`, 'Upload Failed', 'warning');
      } catch {
        showAlert(`"${file.name}" could not be uploaded.`, 'Upload Failed', 'warning');
      }
    }
    setIsUploading(false);
    if (uploaded > 0) {
      await loadCase();
      onChanged();
    }
  };

  const handlePostComment = async (message: string, parentId: string | null) => {
    const text = message.trim();
    if (!text) return;
    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ message: text, parentId })
      });
      const json = await res.json();
      if (!json.success) {
        showAlert(json.error || json.message || 'The comment could not be posted.', 'Comment Failed', 'danger');
        return;
      }
      if (parentId) { setReplyText(''); setReplyToId(null); } else { setCommentText(''); }
      await loadCase();
    } catch {
      showAlert('The comment could not be posted.', 'Comment Failed', 'danger');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleOpenAttachment = async (att: CaseAttachment, forceDownload: boolean) => {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/attachments/${encodeURIComponent(att.id)}/download`, {
        headers: authHeaders
      });
      if (!res.ok) {
        showAlert('The file could not be retrieved.', 'Download Failed', 'danger');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const viewable = /^(application\/pdf|image\/|video\/|audio\/|text\/)/.test(att.mimeType || '');
      if (!forceDownload && viewable) {
        window.open(url, '_blank', 'noopener');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      showAlert('The file could not be retrieved.', 'Download Failed', 'danger');
    }
  };

  if (loadError) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <ShieldAlert size={40} style={{ opacity: 0.4, marginBottom: '1rem' }} />
        <h3 style={{ marginBottom: '0.5rem' }}>Case file unavailable</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{loadError}</p>
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={28} className="spin" style={{ marginBottom: '0.75rem' }} />
        <p>Loading case file...</p>
      </div>
    );
  }

  // Every path passes through the Deputy Director before the Director decides (v2)
  const stageFlow = incident.isEscalated
    ? ['Submitted', 'Under Review', 'Escalated', 'Investigation', 'Pending DD Review', 'Pending Approval', 'Approved', 'Closed']
    : ['Submitted', 'Under Review', 'Pending DD Review', 'Pending Approval', 'Approved', 'Closed'];
  const currentStageIdx = Math.max(0, stageFlow.indexOf(stage));

  const detailRow = (label: string, value?: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{value || '—'}</span>
    </div>
  );

  const narrativeBlocks: [string, string | undefined][] = [
    ['What happened?', incident.whatHappened],
    ['Where did it happen?', incident.whereHappened],
    ['How did it happen?', incident.howHappened],
    ['Who is responsible?', incident.whoResponsible],
    ['Weapons used', incident.weaponsUsed],
    ['Damage done', incident.damageDone],
    ['Action taken', incident.actionTaken],
    ['Lessons learned', incident.lessonsLearned],
    ['Recommendations', incident.recommendations]
  ];

  // Button content that swaps to a spinner while its action is in flight,
  // so users see the request running and don't click twice.
  const busyContent = (key: string, icon: React.ReactNode, idleText: string, busyText: string) =>
    busyAction === key
      ? <><Loader2 size={15} className="spin" /> {busyText}</>
      : <>{icon} {idleText}</>;

  const uploadWidget = (category: string, label: string) => (
    <label
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}
    >
      {isUploading ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
      {isUploading ? 'Uploading...' : label}
      <input
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        style={{ display: 'none' }}
        disabled={isUploading}
        onChange={(e) => { handleUploadFiles(e.target.files, category); e.target.value = ''; }}
      />
    </label>
  );

  return (
    <div>
      {/* Header */}
      <div className="header-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '0.75rem', padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {incident.refNo}
            <span className={`badge ${STAGE_BADGE[stage] || 'muted'}`}>{stage}</span>
            {incident.slaInfo && !isClosed && (
              <span className={`badge ${incident.slaInfo.status === 'On Track' ? 'success' : incident.slaInfo.status === 'At Risk' ? 'warning' : 'danger'}`}>
                SLA: {incident.slaInfo.status}
              </span>
            )}
            {incident.isEscalated ? <span className="badge danger">Escalated{incident.escalationLevel ? ` — ${incident.escalationLevel}` : ''}</span> : null}
          </h1>
          <p className="page-subtitle">
            Reported by {incident.reportedBy} on {incident.dateReported} · {incident.province} · Register {incident.registerNumber}
          </p>
        </div>
      </div>

      {/* Workflow stepper */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {stageFlow.map((s, idx) => (
          <React.Fragment key={s}>
            {idx > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>}
            <span
              className={`badge ${idx < currentStageIdx ? 'success' : idx === currentStageIdx ? (STAGE_BADGE[s] || 'primary') : 'muted'}`}
              style={idx > currentStageIdx ? { opacity: 0.45 } : undefined}
            >
              {idx < currentStageIdx ? '✓ ' : ''}{s}
            </span>
          </React.Fragment>
        ))}
        {(incident.natureOfCase || incident.slaInfo) && (
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {incident.natureOfCase && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} /> Expected resolution: <strong>{incident.natureOfCase}</strong>
              </span>
            )}
            {incident.slaInfo && (isClosed ? (
              <span>
                Completed in <strong>{incident.slaInfo.daysElapsed}</strong> working day{incident.slaInfo.daysElapsed === 1 ? '' : 's'}
                {incident.closedAt ? ` (closed ${formatDate(incident.closedAt)})` : ''}
              </span>
            ) : (
              <>
                <span>
                  Investigation due <strong>{formatDate(incident.slaInfo.expectedDate)}</strong>
                  {' · '}
                  {incident.slaInfo.daysElapsed === 0
                    ? 'reported today'
                    : <>Day <strong>{incident.slaInfo.daysElapsed}</strong> of {incident.slaInfo.targetDays}</>}
                  {' '}
                  {incident.slaInfo.daysRemaining >= 0
                    ? `(${incident.slaInfo.daysRemaining} working day${incident.slaInfo.daysRemaining === 1 ? '' : 's'} left)`
                    : `(overdue by ${-incident.slaInfo.daysRemaining} working day${incident.slaInfo.daysRemaining === -1 ? '' : 's'})`}
                </span>
                <div style={{ width: 170, height: 4, borderRadius: 2, background: 'rgba(128,128,128,0.25)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((incident.slaInfo.daysElapsed / Math.max(1, incident.slaInfo.targetDays)) * 100))}%`,
                      height: '100%',
                      borderRadius: 2,
                      background: incident.slaInfo.daysRemaining < 0 ? '#dc2626'
                        : incident.slaInfo.daysRemaining <= Math.ceil(incident.slaInfo.targetDays * 0.25) ? '#d97706'
                        : '#16a34a'
                    }}
                  />
                </div>
                {incident.slaInfo.coordinatorWindow && (
                  <span>
                    Coordinator window: Day <strong>{incident.slaInfo.coordinatorWindow.daysElapsed}</strong> of {incident.slaInfo.coordinatorWindow.targetDays}
                    {' '}
                    {incident.slaInfo.coordinatorWindow.daysRemaining >= 0
                      ? `(${incident.slaInfo.coordinatorWindow.daysRemaining} working day${incident.slaInfo.coordinatorWindow.daysRemaining === 1 ? '' : 's'} left)`
                      : `(overdue by ${-incident.slaInfo.coordinatorWindow.daysRemaining} working day${incident.slaInfo.coordinatorWindow.daysRemaining === -1 ? '' : 's'})`}
                  </span>
                )}
                {!!incident.slaInfo.extensionDaysGranted && incident.slaInfo.extensionDaysGranted > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#15803d' }}>
                    <CalendarClock size={13} /> Includes a {incident.slaInfo.extensionDaysGranted}-working-day extension
                  </span>
                )}
              </>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT column: case record */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          {/* Incident details */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} /> Incident Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {detailRow('Incident Type(s)', incident.incidentType.join(', '))}
              {detailRow('Department', incident.department)}
              {detailRow('Date & Time of Occurrence', formatDateTime(incident.dateTime))}
              {detailRow('Place of Occurrence', incident.place)}
              {detailRow('Province', incident.province)}
              {detailRow('Classification', incident.classification)}
              {detailRow('Loss Value', `R ${Number(incident.lossValue || 0).toLocaleString()}`)}
              {detailRow('Nature of Case', incident.natureOfCase)}
              {detailRow('Injuries / Fatalities', incident.injuriesFatalities)}
              {detailRow('Reported to SAPS/SSA', incident.reportedToSapsSsa)}
              {incident.sapsCaseNumber ? detailRow('SAPS CAS Number', incident.sapsCaseNumber) : null}
              {incident.policeStation ? detailRow('Police Station', incident.policeStation) : null}
              {detailRow('Reporter Contact', incident.contactDetails)}
              {detailRow('Current Owner', incident.responsiblePerson || 'Unassigned')}
            </div>
            <div style={{ marginTop: '1rem' }}>
              {detailRow('Nature of Loss / Damage', incident.natureOfLoss)}
            </div>
          </div>

          {/* Narrative */}
          {narrativeBlocks.some(([, v]) => v && v.trim()) && (
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Incident Narrative</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {narrativeBlocks.filter(([, v]) => v && v.trim()).map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings & decisions */}
          {(incident.preliminaryFindings || incident.investigationFindings || incident.returnReason || incident.approvalNotes || incident.closureReport || incident.escalationReason || extensionStatus === 'Approved' || extensionStatus === 'Denied') && (
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={18} /> Investigation Record
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {incident.escalationReason && (
                  <div style={{ borderLeft: '3px solid #b45309', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Escalation — {incident.escalationLevel} (by {incident.escalatedBy})</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.escalationReason}{incident.escalationNotes ? `\n${incident.escalationNotes}` : ''}</div>
                  </div>
                )}
                {incident.preliminaryFindings && (
                  <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Preliminary Findings (Security Coordinator)</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.preliminaryFindings}</div>
                  </div>
                )}
                {incident.investigationFindings && (
                  <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Field Investigation Findings ({incident.assignedInvestigator || 'Investigator'}{incident.investigationSubmittedAt ? `, ${formatDateTime(incident.investigationSubmittedAt)}` : ''})
                    </div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.investigationFindings}</div>
                  </div>
                )}
                {incident.returnReason && stage === 'Investigation' && (
                  <div style={{ borderLeft: '3px solid #b91c1c', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Returned by Director — revision required</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.returnReason}</div>
                  </div>
                )}
                {(extensionStatus === 'Approved' || extensionStatus === 'Denied') && (
                  <div style={{ borderLeft: `3px solid ${extensionStatus === 'Approved' ? '#15803d' : '#b91c1c'}`, paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Time Extension {extensionStatus} ({incident.extensionRequestedDays} day{incident.extensionRequestedDays === 1 ? '' : 's'}, requested by {incident.extensionRequestedBy}
                      {incident.extensionDecidedBy ? ` · decided by ${incident.extensionDecidedBy}` : ''})
                    </div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {incident.extensionRequestReason ? `Reason: ${incident.extensionRequestReason}` : ''}
                      {incident.extensionDecisionNote ? `${incident.extensionRequestReason ? '\n' : ''}Message: ${incident.extensionDecisionNote}` : ''}
                    </div>
                  </div>
                )}
                {incident.approvalNotes && (
                  <div style={{ borderLeft: '3px solid #15803d', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Approval Notes ({incident.approvedBy})</div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.approvalNotes}</div>
                  </div>
                )}
                {incident.closureReport && (
                  <div style={{ borderLeft: '3px solid #15803d', paddingLeft: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Closure — {incident.closureOutcome} (by {incident.closedBy}, {formatDateTime(incident.closedAt || '')})
                    </div>
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{incident.closureReport}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Paperclip size={18} /> Documents & Evidence ({caseFile!.attachments.length})
              </h3>
              {canUpload && uploadWidget(
                isAssignedInvestigator ? 'investigation_evidence' : currentUser.role === 'security_coordinator' ? 'preliminary_evidence' : 'reporter_document',
                'Upload Documents'
              )}
            </div>
            {caseFile!.attachments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No documents have been uploaded to this case yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {caseFile!.attachments.map(att => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem',
                      border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.02)'
                    }}
                  >
                    <FileText size={16} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                    <button
                      onClick={() => handleOpenAttachment(att, false)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 600,
                        textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                      title={`Open ${att.fileName}`}
                    >
                      {att.fileName}
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                      {formatFileSize(att.fileSize)} · {att.uploadedByName} · {formatDateTime(att.dateCreated)}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenAttachment(att, true)}
                      style={{ padding: '0.3rem 0.5rem', flexShrink: 0 }}
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case discussion / comment thread */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} /> Case Discussion ({caseFile!.comments.length})
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
              Messages between the case parties — the reporter, coordinator, investigator and director. Every entry is recorded with the author, role and time.
            </p>

            {caseFile!.comments.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                No comments yet.{!isClosed && ' Start the discussion below.'}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {caseFile!.comments.filter(c => !c.parentId).map(comment => {
                const replies = caseFile!.comments.filter(c => c.parentId === comment.id);
                const renderBubble = (c: CaseComment) => {
                  const isMine = c.author === currentUser.username;
                  return (
                    <div
                      style={{
                        padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                        background: isMine ? 'rgba(59, 130, 246, 0.10)' : 'rgba(0,0,0,0.02)',
                        border: isMine ? '1px solid rgba(59, 130, 246, 0.30)' : '1px solid var(--border-color)',
                        borderLeft: isMine ? '3px solid var(--color-primary)' : '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                          {isMine ? 'You' : c.authorName}
                        </span>
                        <span style={{
                          fontSize: '0.64rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                          padding: '0.1rem 0.4rem', borderRadius: '999px',
                          background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)'
                        }}>
                          {ROLE_LABELS[c.authorRole as keyof typeof ROLE_LABELS] || c.authorRole}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {formatDateTime(c.dateCreated)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.83rem', marginTop: '0.3rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {c.message}
                      </div>
                    </div>
                  );
                };
                return (
                  <div key={comment.id}>
                    {renderBubble(comment)}
                    {(replies.length > 0 || replyToId === comment.id) && (
                      <div style={{ marginLeft: '1.4rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '0.75rem' }}>
                        {replies.map(reply => <div key={reply.id}>{renderBubble(reply)}</div>)}
                        {replyToId === comment.id && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <textarea
                              rows={2}
                              className="form-input"
                              style={{ flexGrow: 1 }}
                              placeholder={`Reply to ${comment.author === currentUser.username ? 'your comment' : comment.authorName}...`}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.7rem' }}
                                disabled={isPostingComment || !replyText.trim()}
                                onClick={() => handlePostComment(replyText, comment.id)}
                              >
                                {isPostingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.7rem' }}
                                onClick={() => { setReplyToId(null); setReplyText(''); }}
                                title="Cancel reply"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!isClosed && replyToId !== comment.id && (
                      <button
                        onClick={() => { setReplyToId(comment.id); setReplyText(''); }}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem 0',
                          marginLeft: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                          fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-primary)'
                        }}
                      >
                        <CornerDownRight size={13} /> Reply
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isClosed ? (
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: caseFile!.comments.length > 0 ? '0.85rem 0 0 0' : 0 }}>
                This case is closed — the discussion thread is read-only.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: caseFile!.comments.length > 0 ? '1rem' : 0 }}>
                <textarea
                  rows={2}
                  className="form-input"
                  style={{ flexGrow: 1 }}
                  placeholder="Write a comment for the case parties..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 0.9rem' }}
                  disabled={isPostingComment || !commentText.trim()}
                  onClick={() => handlePostComment(commentText, null)}
                >
                  {isPostingComment ? <Loader2 size={15} className="animate-spin" /> : <><Send size={15} /> Post</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column: actions + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          {/* ROLE ACTION PANEL */}
          {!isClosed && (isCoordinatorForCase || isDirector || isAssignedInvestigator || canAssignCoordinator || canDecideExtension || (isDeputyDirector && stage === 'Pending DD Review')) && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Case Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Director / Deputy Director: decide a pending time-extension request */}
                {canDecideExtension && (
                  <div style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <CalendarClock size={15} /> Time Extension Requested
                    </div>
                    <div style={{ fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                      <strong>{incident.extensionRequestedBy}</strong>
                      {incident.extensionRequestedByRole ? ` (${ROLE_LABELS[incident.extensionRequestedByRole as keyof typeof ROLE_LABELS] || incident.extensionRequestedByRole})` : ''} requested{' '}
                      <strong>{incident.extensionRequestedDays} working day{incident.extensionRequestedDays === 1 ? '' : 's'}</strong>.
                      {incident.extensionRequestReason && (
                        <div style={{ marginTop: '0.3rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                          Reason: {incident.extensionRequestReason}
                        </div>
                      )}
                    </div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Message to the requester</label>
                    <textarea
                      rows={2}
                      className="form-input"
                      placeholder="Optional when approving; required when denying."
                      value={extensionDecisionNote}
                      onChange={(e) => setExtensionDecisionNote(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-success"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null}
                        onClick={() =>
                          showConfirm({
                            title: 'Approve Extension',
                            message: `Grant ${incident.extensionRequestedDays} working day${incident.extensionRequestedDays === 1 ? '' : 's'} to ${incident.extensionRequestedBy} on ${incident.refNo}? The SLA deadline will be extended accordingly.`,
                            confirmText: 'Approve Extension',
                            onConfirm: async () => {
                              const ok = await runAction('ext-decide', `/api/incidents/${incidentId}/extension-decision`, 'POST',
                                { decision: 'approve', note: extensionDecisionNote.trim() }, 'Extension approved — the requester has been notified.');
                              if (ok) setExtensionDecisionNote('');
                            }
                          })
                        }
                      >
                        {busyContent('ext-decide', <CheckCircle2 size={15} />, 'Approve', 'Saving...')}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null || !extensionDecisionNote.trim()}
                        title={extensionDecisionNote.trim() ? undefined : 'A message is required when denying'}
                        onClick={() =>
                          showConfirm({
                            title: 'Deny Extension',
                            message: `Deny the extension request from ${incident.extensionRequestedBy} on ${incident.refNo}?`,
                            confirmText: 'Deny Extension',
                            onConfirm: async () => {
                              const ok = await runAction('ext-decide', `/api/incidents/${incidentId}/extension-decision`, 'POST',
                                { decision: 'deny', note: extensionDecisionNote.trim() }, 'Extension denied — the requester has been notified.');
                              if (ok) setExtensionDecisionNote('');
                            }
                          })
                        }
                      >
                        {busyContent('ext-decide', <Undo2 size={15} />, 'Deny', 'Saving...')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Director / Deputy Director: assign this unassigned incident to a coordinator */}
                {canAssignCoordinator && (
                  <div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={busyAction !== null}
                      onClick={() => { setSelectedCoordinator(''); setShowAssignCoordForm(true); }}
                    >
                      <Users size={15} /> Assign to Coordinator
                    </button>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      This incident has not yet been assigned to a coordinator.
                    </div>
                  </div>
                )}

                {/* Coordinator / investigator: pending extension request they raised */}
                {extensionPending && (coordinatorHasAccepted || isAssignedInvestigator) && (
                  <div style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CalendarClock size={15} /> Extension requested ({incident.extensionRequestedDays} day{incident.extensionRequestedDays === 1 ? '' : 's'}) — awaiting the Director / Deputy Director's decision.
                  </div>
                )}

                {/* Coordinator / investigator: request a time extension (window at risk/overdue) */}
                {myWindowNeedsExtension && !showExtensionForm && (
                  <button
                    className="btn btn-secondary"
                    disabled={busyAction !== null}
                    onClick={() => { setExtensionDays(1); setExtensionReason(''); setShowExtensionForm(true); }}
                  >
                    <CalendarClock size={15} /> Request Time Extension
                  </button>
                )}
                {myWindowNeedsExtension && showExtensionForm && (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Request Time Extension</label>
                    <select className="form-input" value={extensionDays} onChange={(e) => setExtensionDays(Number(e.target.value))}>
                      <option value={1}>1 working day</option>
                      <option value={2}>2 working days</option>
                    </select>
                    <textarea
                      rows={3}
                      className="form-input"
                      style={{ marginTop: '0.5rem' }}
                      placeholder="Why do you need more time to complete the investigation?"
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null || !extensionReason.trim()}
                        onClick={async () => {
                          const ok = await runAction('ext-request', `/api/incidents/${incidentId}/request-extension`, 'POST',
                            { days: extensionDays, reason: extensionReason.trim() }, 'Extension request sent — the Director and Deputy Director have been notified.');
                          if (ok) { setShowExtensionForm(false); setExtensionReason(''); }
                        }}
                      >
                        {busyContent('ext-request', <Send size={15} />, 'Submit Request', 'Submitting...')}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowExtensionForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Coordinator: accept & review */}
                {isCoordinatorForCase && stage === 'Submitted' && (
                  <button
                    className="btn btn-primary"
                    disabled={busyAction !== null}
                    onClick={() => runAction('review', `/api/incidents/${incidentId}/review`, 'POST', {}, 'Review started — the reporter has been notified.')}
                  >
                    {busyContent('review', <UserCheck size={15} />, 'Accept Case & Start Review', 'Starting Review...')}
                  </button>
                )}

                {/* Coordinator: preliminary findings */}
                {coordinatorHasAccepted && ['Submitted', 'Under Review'].includes(stage) && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Preliminary Investigation Findings</label>
                    <textarea
                      rows={4}
                      className="form-input"
                      placeholder="Capture the preliminary investigation findings, evidence references and initial assessment..."
                      value={preliminaryText}
                      onChange={(e) => setPreliminaryText(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={busyAction !== null || !preliminaryText.trim()}
                      onClick={() => runAction('preliminary', `/api/incidents/${incidentId}/preliminary`, 'PUT', { preliminaryFindings: preliminaryText }, 'Preliminary findings saved.')}
                    >
                      {busyContent('preliminary', <ClipboardCheck size={15} />, 'Save Preliminary Findings', 'Saving Findings...')}
                    </button>
                  </div>
                )}

                {/* Coordinator: submit the preliminary investigation to the Deputy Director (v2 —
                    coordinators never close directly; every case goes DD -> Director first) */}
                {coordinatorHasAccepted && stage === 'Under Review' && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Submit to Deputy Director</label>
                    <select
                      className="form-input"
                      value={requestedOutcome}
                      onChange={(e) => setRequestedOutcome(e.target.value as 'close' | 'investigate')}
                    >
                      <option value="close">Request Case Closure</option>
                      <option value="investigate">Request Further Investigation</option>
                    </select>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={busyAction !== null || !(incident.preliminaryFindings || '').trim()}
                      title={(incident.preliminaryFindings || '').trim() ? undefined : 'Save the preliminary findings first'}
                      onClick={() =>
                        showConfirm({
                          title: 'Submit for Review',
                          message: `Submit case ${incident.refNo} to the Deputy Director requesting ${requestedOutcome === 'close' ? 'case closure' : 'further investigation'}? The Chief Security Director makes the final decision.`,
                          confirmText: 'Submit to Deputy Director',
                          onConfirm: () => {
                            runAction('submit-dd', `/api/incidents/${incidentId}/submit-to-dd`, 'POST',
                              { requestedOutcome }, 'Case submitted — the Deputy Director has been notified.');
                          }
                        })
                      }
                    >
                      {busyContent('submit-dd', <Send size={15} />, 'Submit to Deputy Director', 'Submitting...')}
                    </button>
                    {!(incident.preliminaryFindings || '').trim() && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        Save the preliminary investigation findings before submitting.
                      </div>
                    )}
                  </div>
                )}

                {/* Close: coordinator only after the Director approved; director anytime (final authority) */}
                {(
                  (coordinatorHasAccepted && stage === 'Approved') ||
                  (isDirector && !isClosed)
                ) && (
                  <button className="btn btn-success" disabled={busyAction !== null} onClick={() => setShowCloseForm(true)}>
                    <CheckCircle2 size={15} /> {stage === 'Approved' ? 'Close Case (Approved)' : 'Close Case'}
                  </button>
                )}

                {/* Deputy Director: verify the submission + record formal recommendations */}
                {isDeputyDirector && stage === 'Pending DD Review' && (
                  <div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                      <strong>{incident.submittedToDdBy || 'The submitter'}</strong> requested{' '}
                      <strong>{incident.requestedOutcome === 'investigate' ? 'further investigation' : 'case closure'}</strong>
                      {incident.submittedToDdAt ? ` on ${formatDateTime(incident.submittedToDdAt)}` : ''}.
                      Review the {incident.assignedInvestigator ? 'field investigation findings' : 'preliminary investigation'}, then record your formal recommendations for the Chief Security Director.
                    </div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Formal Recommendations *</label>
                    <textarea
                      rows={5}
                      className="form-input"
                      placeholder="Verify the report and record your formal recommendations: adequacy of the investigation, risk assessment, recommended outcome and any conditions..."
                      value={ddRecommendationText}
                      onChange={(e) => setDdRecommendationText(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-success"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null || !ddRecommendationText.trim()}
                        onClick={() =>
                          showConfirm({
                            title: 'Recommend Closure',
                            message: `Forward case ${incident.refNo} to the Chief Security Director recommending closure?`,
                            confirmText: 'Recommend Closure',
                            onConfirm: () => {
                              runAction('dd-review', `/api/incidents/${incidentId}/dd-review`, 'POST',
                                { recommendation: ddRecommendationText, recommendedAction: 'close' },
                                'Recommendation recorded — the Chief Security Director has been notified.');
                            }
                          })
                        }
                      >
                        {busyContent('dd-review', <CheckCircle2 size={15} />, 'Recommend Closure', 'Forwarding...')}
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null || !ddRecommendationText.trim()}
                        onClick={() =>
                          showConfirm({
                            title: 'Recommend Further Investigation',
                            message: `Forward case ${incident.refNo} to the Chief Security Director recommending further investigation?`,
                            confirmText: 'Recommend Investigation',
                            onConfirm: () => {
                              runAction('dd-review', `/api/incidents/${incidentId}/dd-review`, 'POST',
                                { recommendation: ddRecommendationText, recommendedAction: 'investigate' },
                                'Recommendation recorded — the Chief Security Director has been notified.');
                            }
                          })
                        }
                      >
                        {busyContent('dd-review', <Search size={15} />, 'Recommend Further Investigation', 'Forwarding...')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Director: assign investigator (also straight off a DD "investigate" recommendation) */}
                {isDirector && ['Escalated', 'Investigation', 'Pending Approval'].includes(stage) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      {stage === 'Escalated' ? 'Assign Chief Investigator'
                        : stage === 'Pending Approval' ? 'Order Further Investigation — Assign Investigator'
                        : 'Reassign Investigator'}
                    </label>
                    <select className="form-input" value={selectedInvestigator} onChange={(e) => setSelectedInvestigator(e.target.value)}>
                      <option value="">Select investigator</option>
                      {investigators.map(inv => (
                        <option key={inv.username} value={inv.username}>{inv.displayName} — {inv.office}</option>
                      ))}
                    </select>
                    <textarea
                      rows={2}
                      className="form-input"
                      style={{ marginTop: '0.5rem' }}
                      placeholder="Instructions for the field investigation (optional)"
                      value={assignInstructions}
                      onChange={(e) => setAssignInstructions(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      disabled={busyAction !== null || !selectedInvestigator}
                      onClick={() => runAction('assign', `/api/incidents/${incidentId}/assign-investigator`, 'POST',
                        { investigatorUsername: selectedInvestigator, instructions: assignInstructions.trim() },
                        'Investigator assigned and notified.')}
                    >
                      {busyContent('assign', <Send size={15} />, 'Assign for Field Investigation', 'Assigning...')}
                    </button>
                  </div>
                )}

                {/* Investigator: capture findings + submit for approval */}
                {isAssignedInvestigator && stage === 'Investigation' && (
                  <div>
                    {incident.returnReason && Number(incident.returnCount) > 0 && (
                      <div style={{ background: 'rgba(185, 28, 28, 0.08)', border: '1px solid rgba(185, 28, 28, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                        <strong>Returned by the Director:</strong> {incident.returnReason}
                      </div>
                    )}
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Field Investigation Findings & Overview</label>
                    <textarea
                      rows={6}
                      className="form-input"
                      placeholder="Document the field investigation: evidence collected, site inspection outcome, witness statements, overview and conclusions..."
                      value={findingsText}
                      onChange={(e) => setFindingsText(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {uploadWidget('investigation_evidence', 'Upload Field Evidence')}
                      <button
                        className="btn btn-primary"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null || !findingsText.trim()}
                        onClick={() =>
                          showConfirm({
                            title: 'Submit for Review',
                            message: `Submit your field investigation findings for case ${incident.refNo} to the Deputy Director for verification? The Chief Security Director makes the final decision.`,
                            confirmText: 'Submit Findings',
                            onConfirm: () => {
                              runAction('submit-inv', `/api/incidents/${incidentId}/submit-investigation`, 'POST',
                                { investigationFindings: findingsText }, 'Findings submitted — the Deputy Director has been notified.');
                            }
                          })
                        }
                      >
                        {busyContent('submit-inv', <Send size={15} />, 'Submit for Approval', 'Submitting...')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Director: approve / return */}
                {isDirector && stage === 'Pending Approval' && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    {incident.ddRecommendation && (
                      <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                        <strong>Deputy Director recommendation — {incident.ddRecommendedAction === 'investigate' ? 'further investigation' : 'closure'}</strong>
                        <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{incident.ddRecommendation}</div>
                        <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {incident.ddReviewedBy}{incident.ddReviewedAt ? ` · ${formatDateTime(incident.ddReviewedAt)}` : ''}
                        </div>
                      </div>
                    )}
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Approval Decision</label>
                    <textarea
                      rows={3}
                      className="form-input"
                      placeholder="Notes (required when returning the investigation)"
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-success"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null}
                        onClick={() =>
                          showConfirm({
                            title: 'Approve Investigation',
                            message: `Approve the field investigation for ${incident.refNo}? The provincial coordinator will be notified to close the case.`,
                            confirmText: 'Approve',
                            onConfirm: () => {
                              runAction('approve', `/api/incidents/${incidentId}/approval-decision`, 'POST',
                                { decision: 'approve', notes: decisionNotes.trim() }, 'Investigation approved — the coordinator has been notified.');
                            }
                          })
                        }
                      >
                        {busyContent('approve', <CheckCircle2 size={15} />, 'Approve', 'Approving...')}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flexGrow: 1 }}
                        disabled={busyAction !== null}
                        onClick={() => setShowReturnForm(true)}
                      >
                        <Undo2 size={15} /> Return
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isClosed && (
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <CheckCircle2 size={28} style={{ color: 'green', opacity: 0.7, marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 700 }}>Case Closed — {incident.closureOutcome || 'Closed'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Closed by {incident.closedBy || '—'} on {formatDateTime(incident.closedAt || '')}. The record is archived and immutable.
              </div>
            </div>
          )}

          {/* Workflow timeline */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Workflow Timeline</h3>
            {caseFile!.events.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>No workflow events recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...caseFile!.events].reverse().map((evt, idx, arr) => (
                  <div key={evt.id} style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '50%', marginTop: '0.35rem', flexShrink: 0,
                        background: idx === 0 ? 'var(--color-accent, #b45309)' : 'var(--border-color)'
                      }} />
                      {idx < arr.length - 1 && <span style={{ width: '2px', flexGrow: 1, background: 'var(--border-color)' }} />}
                    </div>
                    <div style={{ paddingBottom: '1rem', minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{EVENT_LABEL[evt.eventType] || evt.eventType}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {evt.actorName} · {formatDateTime(evt.dateCreated)}
                      </div>
                      {evt.notes && <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{evt.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close-case drawer */}
      {showCloseForm && (
        <div className="drawer-backdrop" onClick={() => setShowCloseForm(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'hsl(var(--color-primary))' }}>Close Case</h3>
                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{incident.refNo} · {incident.province}</span>
              </div>
              <button onClick={() => setShowCloseForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              <div className="form-group">
                <label className="form-label">Outcome Classification *</label>
                <select className="form-input" value={closureOutcome} onChange={(e) => setClosureOutcome(e.target.value)}>
                  {CLOSURE_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Closure Report / Outcome Summary *</label>
                <textarea
                  rows={6}
                  className="form-input"
                  placeholder="Summarise the outcome of the case: findings, recovery, referral details or reasons the report was unfounded. This summary is sent to the reporter."
                  value={closureReport}
                  onChange={(e) => setClosureReport(e.target.value)}
                />
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="btn btn-success"
                style={{ flexGrow: 1 }}
                disabled={busyAction !== null || !closureReport.trim()}
                onClick={async () => {
                  const ok = await runAction('close', `/api/incidents/${incidentId}/close`, 'POST',
                    { closureOutcome, closureReport }, 'Case closed — the reporter has been notified of the outcome.');
                  if (ok) setShowCloseForm(false);
                }}
              >
                {busyContent('close', <CheckCircle2 size={16} />, 'Close Case & Notify Reporter', 'Closing...')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCloseForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign-coordinator drawer (Director / Deputy Director) */}
      {showAssignCoordForm && (
        <div className="drawer-backdrop" onClick={() => setShowAssignCoordForm(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'hsl(var(--color-primary))' }}>Assign to Coordinator</h3>
                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{incident.refNo} · {incident.province}</span>
              </div>
              <button onClick={() => setShowAssignCoordForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              {loadingCoords && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                  <Loader2 size={22} className="spin" /> <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Loading coordinators...</div>
                </div>
              )}
              {!loadingCoords && assignableCoords && (
                <>
                  <div className="form-group">
                    <label className="form-label">Recommended — {incident.province}</label>
                    {assignableCoords.recommended.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>
                        No available coordinator in {incident.province} (all on leave or none configured). Choose from another province below.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {assignableCoords.recommended.map(c => (
                          <label key={c.username} className={`chip-select-row ${selectedCoordinator === c.username ? 'active' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selectedCoordinator === c.username ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                            <input type="radio" name="assign-coord" value={c.username} checked={selectedCoordinator === c.username} onChange={() => setSelectedCoordinator(c.username)} />
                            <span style={{ fontSize: '0.85rem' }}>{c.displayName}{c.office ? <span style={{ color: 'var(--text-muted)' }}> — {c.office}</span> : null}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {assignableCoords.others.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Other provinces</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {assignableCoords.others.map(c => (
                          <label key={c.username} className={`chip-select-row ${selectedCoordinator === c.username ? 'active' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selectedCoordinator === c.username ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                            <input type="radio" name="assign-coord" value={c.username} checked={selectedCoordinator === c.username} onChange={() => setSelectedCoordinator(c.username)} />
                            <span style={{ fontSize: '0.85rem' }}>{c.displayName} <span style={{ color: 'var(--text-muted)' }}>· {c.province}{c.office ? ` — ${c.office}` : ''}</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="drawer-footer">
              <button
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
                disabled={busyAction !== null || !selectedCoordinator}
                onClick={async () => {
                  const ok = await runAction('assign-coord', `/api/incidents/${incidentId}/assign-coordinator`, 'POST',
                    { coordinatorUsername: selectedCoordinator }, 'Coordinator assigned — they have been notified.');
                  if (ok) setShowAssignCoordForm(false);
                }}
              >
                {busyContent('assign-coord', <Send size={16} />, 'Assign Coordinator', 'Assigning...')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAssignCoordForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Return-investigation drawer */}
      {showReturnForm && (
        <div className="drawer-backdrop" onClick={() => setShowReturnForm(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'hsl(var(--color-primary))' }}>Return Investigation</h3>
                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{incident.refNo} · back to {incident.assignedInvestigator}</span>
              </div>
              <button onClick={() => setShowReturnForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              <div className="form-group">
                <label className="form-label">Reason for Return / Required Work *</label>
                <textarea
                  rows={5}
                  className="form-input"
                  placeholder="Explain what is incomplete or requires further investigation. The investigator will continue the field work and resubmit."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
                disabled={busyAction !== null || !decisionNotes.trim()}
                onClick={async () => {
                  const ok = await runAction('return', `/api/incidents/${incidentId}/approval-decision`, 'POST',
                    { decision: 'return', notes: decisionNotes.trim() },
                    'Investigation returned — the investigator has been notified.');
                  if (ok) { setShowReturnForm(false); setDecisionNotes(''); }
                }}
              >
                {busyContent('return', <Undo2 size={16} />, 'Return to Investigator', 'Returning...')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowReturnForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
