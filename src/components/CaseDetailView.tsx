import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CaseAttachment, CaseEvent, SecurityIncident } from '../types/security';
import { CLOSURE_OUTCOMES } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import {
  ArrowLeft, ArrowUpCircle, CheckCircle2, ClipboardCheck, Clock, Download,
  FileText, Loader2, Paperclip, Send, ShieldAlert, UploadCloud, UserCheck, Undo2, X
} from 'lucide-react';
import { useModal } from './NotificationModal';

// The full case file — opened by clicking a case anywhere in the app (#/case/<id>).
// Shows the incident record, workflow timeline, attachments and the actions the
// current user's role may take at the case's current workflow stage.

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
  FINDINGS_SUBMITTED: 'Findings submitted for approval',
  RETURNED: 'Investigation returned',
  APPROVED: 'Investigation approved',
  CLOSED: 'Case closed',
  ATTACHMENT_ADDED: 'Document uploaded'
};

const ESCALATION_REASONS = [
  'Complex investigation requires national support',
  'High-risk or major security breach',
  'SLA risk or overdue investigation',
  'Potential criminal matter requiring executive visibility',
  'Sensitive classification or confidential information exposure'
];

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
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalationLevel, setEscalationLevel] = useState('Major');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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
  const stage = (incident?.workflowStage as string) || 'Submitted';
  const isClosed = stage === 'Closed' || incident?.status === 'Closed';

  const isDirector = currentUser.role === 'security_director';
  const isCoordinatorForCase = !!incident &&
    currentUser.role === 'security_coordinator' &&
    incident.province === currentUser.province &&
    (!incident.responsiblePerson || incident.responsiblePerson === 'Unassigned' || incident.responsiblePerson === currentUser.displayName);
  const isAssignedInvestigator = !!incident &&
    currentUser.role === 'chief_security_investigator' &&
    (incident.responsiblePerson === currentUser.displayName || incident.assignedInvestigator === currentUser.displayName);
  const isReporter = !!incident &&
    (incident.ownerId === currentUser.username || incident.contactDetails === currentUser.email || incident.reportedBy === currentUser.displayName);

  const canUpload = !isClosed && (isDirector || isCoordinatorForCase || isAssignedInvestigator || isReporter);

  // Load the assignment dropdown only when the director can actually assign
  useEffect(() => {
    if (!isDirector || !incident || !['Escalated', 'Investigation'].includes(stage)) return;
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

  const stageFlow = incident.isEscalated
    ? ['Submitted', 'Under Review', 'Escalated', 'Investigation', 'Pending Approval', 'Approved', 'Closed']
    : ['Submitted', 'Under Review', 'Closed'];
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
          {(incident.preliminaryFindings || incident.investigationFindings || incident.returnReason || incident.approvalNotes || incident.closureReport || incident.escalationReason) && (
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
        </div>

        {/* RIGHT column: actions + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          {/* ROLE ACTION PANEL */}
          {!isClosed && (isCoordinatorForCase || isDirector || isAssignedInvestigator) && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Case Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

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
                {isCoordinatorForCase && ['Submitted', 'Under Review'].includes(stage) && (
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

                {/* Coordinator: close small case / close after approval */}
                {(
                  (isCoordinatorForCase && ['Submitted', 'Under Review', 'Approved'].includes(stage)) ||
                  (isDirector && !isClosed)
                ) && (
                  <button className="btn btn-success" disabled={busyAction !== null} onClick={() => setShowCloseForm(true)}>
                    <CheckCircle2 size={15} /> {stage === 'Approved' ? 'Close Case (Approved)' : 'Close Case'}
                  </button>
                )}

                {/* Coordinator: escalate big case */}
                {isCoordinatorForCase && ['Submitted', 'Under Review'].includes(stage) && !incident.isEscalated && (
                  <button className="btn btn-primary" disabled={busyAction !== null} onClick={() => setShowEscalateForm(true)}>
                    <ArrowUpCircle size={15} /> Escalate to Security Director
                  </button>
                )}

                {/* Director: assign investigator */}
                {isDirector && ['Escalated', 'Investigation'].includes(stage) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      {stage === 'Escalated' ? 'Assign Chief Investigator' : 'Reassign Investigator'}
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
                            title: 'Submit for Approval',
                            message: `Submit your field investigation findings for case ${incident.refNo} to the Security Director for approval?`,
                            confirmText: 'Submit Findings',
                            onConfirm: () => {
                              runAction('submit-inv', `/api/incidents/${incidentId}/submit-investigation`, 'POST',
                                { investigationFindings: findingsText }, 'Findings submitted — the Security Director has been notified.');
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

      {/* Escalation drawer */}
      {showEscalateForm && (
        <div className="drawer-backdrop" onClick={() => setShowEscalateForm(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'hsl(var(--color-primary))' }}>Escalate to Security Director</h3>
                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{incident.refNo} · {incident.classification}</span>
              </div>
              <button onClick={() => setShowEscalateForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="drawer-content">
              <div className="form-group">
                <label className="form-label">Escalation Level</label>
                <select className="form-input" value={escalationLevel} onChange={(e) => setEscalationLevel(e.target.value)}>
                  <option value="Major">Major</option>
                  <option value="High Risk">High Risk</option>
                  <option value="Critical">Critical</option>
                  <option value="National Review">National Review</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Escalation Reason *</label>
                <select className="form-input" value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)}>
                  <option value="">Select reason</option>
                  {ESCALATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes for the Security Director</label>
                <textarea
                  rows={4}
                  className="form-input"
                  placeholder="Investigation context, immediate risk, evidence references or requested support..."
                  value={escalationNotes}
                  onChange={(e) => setEscalationNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
                disabled={busyAction !== null || !escalationReason}
                onClick={async () => {
                  const ok = await runAction('escalate', `/api/incidents/${incidentId}/escalate`, 'POST',
                    { escalationLevel, escalationReason, escalationNotes: escalationNotes.trim() },
                    'Case escalated — the Security Director has been notified.');
                  if (ok) setShowEscalateForm(false);
                }}
              >
                {busyContent('escalate', <ArrowUpCircle size={16} />, 'Submit Escalation', 'Escalating...')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEscalateForm(false)}>Cancel</button>
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
