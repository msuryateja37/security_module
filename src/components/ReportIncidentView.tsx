import React, { useState } from 'react';
import type { SecurityIncident, ProvinceType } from '../types/security';
import { NATURE_OF_CASE_OPTIONS } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { PROVINCES } from '../data/mockData';
import { Shield, FileText, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle, Paperclip, X, UploadCloud, Check, Send, Search, UserCheck } from 'lucide-react';
import { useModal } from './NotificationModal';

interface ReportIncidentViewProps {
  /** Persists the incident; resolves once the server accepted it so attachments can follow. */
  onAddIncident: (incident: SecurityIncident) => Promise<boolean>;
  onNavigate: (view: string) => void;
  currentUser?: UserProfile;
  /** Draft prepared by the SIMS Assistant — seeds the form; the user reviews and submits manually. */
  initialData?: Partial<SecurityIncident>;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.txt,.csv,.rtf,.msg,.eml,.zip,.mp4,.mov,.mp3,.wav';

// Fallback list — the live list comes from the system configuration
// (FR-039, Administration → System Configuration → Incident Categories).
const INCIDENT_TYPES_LIST = [
  'Loss of information', 'Armed Robbery', 'Violence (workplace)', 'Conflict of interest',
  'Malicious damage to property', 'Trespassing', 'Bomb Threat', 'Robbery', 'Fraud',
  'Extortion', 'Sabotage', 'Drugs', 'Harassment', 'Assault', 'Theft', 'Kidnapping',
  'Arson', 'Pouching', 'Accidental Discharge of a firearm', 'Acts of terrorism / terror',
  'Violation of permit system', 'Fire', 'Explosion', 'Hostage situation', 'Firearm related',
  'Permit related', 'Firearm left unattended', 'Accidental damage to property'
];

const STEP_LABELS = ['General & Contact Info', 'Categorization & Loss', 'Narrative Report'];

/** Minimal employee identification returned by /api/users/lookup ("Report For: Others"). */
interface DirectoryUser {
  username: string;
  displayName: string;
  persalNumber?: string;
  jobTitle?: string;
  province?: string;
}

const RequiredStar = () => <span className="required-star"> *</span>;

export const ReportIncidentView: React.FC<ReportIncidentViewProps> = ({ onAddIncident, onNavigate, currentUser, initialData }) => {
  const [formType, setFormType] = useState<'standard' | 'noc'>('standard');
  const [currentStep, setCurrentStep] = useState(1);
  const { showAlert } = useModal();
  const defaultProvince = currentUser?.province && PROVINCES.includes(currentUser.province as ProvinceType)
    ? currentUser.province as ProvinceType
    : 'Gauteng';
  const draftProvince = initialData?.province && PROVINCES.includes(initialData.province as ProvinceType)
    ? initialData.province as ProvinceType
    : undefined;

  // Form fields state (seeded from the assistant draft when present)
  const [department, setDepartment] = useState('Chief Directorate: Security and Facilities Management Services');
  const [contactDetails, setContactDetails] = useState(currentUser?.email || '');
  const [dateTime, setDateTime] = useState(initialData?.dateTime || '');
  const [place, setPlace] = useState(initialData?.place || '');
  const [province, setProvince] = useState<ProvinceType>(draftProvince || defaultProvince);
  const [lossValue, setLossValue] = useState<string | number>(initialData?.lossValue ?? '');
  const [natureOfLoss, setNatureOfLoss] = useState(initialData?.natureOfLoss || '');
  const [injuriesFatalities, setInjuriesFatalities] = useState(initialData?.injuriesFatalities || 'None');
  const [reportedBy, setReportedBy] = useState(currentUser?.displayName || '');
  // "Report For" — reporting for yourself or on behalf of another employee.
  // Only the tagged employee's name is stored for now; richer linking comes later.
  const [reportFor, setReportFor] = useState<'Self' | 'Others'>(initialData?.reportFor === 'Others' ? 'Others' : 'Self');
  const [reportForEmployee, setReportForEmployee] = useState<DirectoryUser | null>(null);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeResults, setEmployeeResults] = useState<DirectoryUser[]>([]);
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false);
  const [sapsCaseNumber, setSapsCaseNumber] = useState(initialData?.sapsCaseNumber || '');
  const [policeStation, setPoliceStation] = useState(initialData?.policeStation || '');
  const [arrests] = useState<string | number>('');
  const [classification, setClassification] = useState<SecurityIncident['classification']>(initialData?.classification || 'Unclassified');
  const [reportedToSaps, setReportedToSaps] = useState<SecurityIncident['reportedToSapsSsa']>(initialData?.reportedToSapsSsa || 'No');
  // Expected resolution window for the case (required on both form types)
  const [natureOfCase, setNatureOfCase] = useState<string>(initialData?.natureOfCase || '');
  // Supporting documents chosen by the reporter — uploaded right after the incident is created
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Selected incident types
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    (initialData?.incidentType || []).filter(t => INCIDENT_TYPES_LIST.includes(t))
  );
  const [otherTypeDetails, setOtherTypeDetails] = useState(initialData?.otherIncidentTypeDetails || '');

  // Incident categories configured by the System Administrator (FR-039)
  const [incidentTypes, setIncidentTypes] = useState<string[]>(INCIDENT_TYPES_LIST);
  React.useEffect(() => {
    if (!currentUser) return;
    fetch('/api/config/form-options', {
      headers: { 'x-username': currentUser.username, 'x-user-role': currentUser.role }
    })
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data?.incidentTypes) && json.data.incidentTypes.length > 0) {
          setIncidentTypes(json.data.incidentTypes);
        }
      })
      .catch(() => { /* keep the fallback list */ });
  }, [currentUser]);

  // Debounced employee directory search for the "Report For: Others" picker
  React.useEffect(() => {
    if (reportFor !== 'Others' || !currentUser) return;
    const q = employeeQuery.trim();
    if (q.length < 2) {
      setEmployeeResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingEmployees(true);
      fetch(`/api/users/lookup?q=${encodeURIComponent(q)}`, {
        headers: { 'x-username': currentUser.username, 'x-user-role': currentUser.role }
      })
        .then(res => res.json())
        .then(json => setEmployeeResults(json.success && Array.isArray(json.data) ? json.data : []))
        .catch(() => setEmployeeResults([]))
        .finally(() => setIsSearchingEmployees(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [employeeQuery, reportFor, currentUser]);

  // Narrative steps
  const [whatHappened, setWhatHappened] = useState(initialData?.whatHappened || '');
  const [whereHappened, setWhereHappened] = useState(initialData?.whereHappened || '');
  const [howHappened, setHowHappened] = useState(initialData?.howHappened || '');
  const [whoResponsible, setWhoResponsible] = useState(initialData?.whoResponsible || '');
  const [proceduresUsed, setProceduresUsed] = useState(initialData?.proceduresUsed || '');
  const [weaponsUsed, setWeaponsUsed] = useState(initialData?.weaponsUsed || '');
  const [damageDone, setDamageDone] = useState(initialData?.damageDone || '');
  const [actionTaken, setActionTaken] = useState(initialData?.actionTaken || '');
  const [securityMeasuresEffectiveness, setSecurityMeasuresEffectiveness] = useState('');
  const [securityPersonnelReaction, setSecurityPersonnelReaction] = useState('');
  const [otherAspects, setOtherAspects] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [recommendations, setRecommendations] = useState('');

  // NOC specific initial notification brief
  const [nocBriefDetails, setNocBriefDetails] = useState('');
  const [nocDutyRef, setNocDutyRef] = useState('');

  const [generatedRefNo, setGeneratedRefNo] = useState('');
  const [generatedRegNo, setGeneratedRegNo] = useState('');

  // Toggle incident type pill
  const handleToggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!reportedBy || !dateTime || !place || !contactDetails) {
        showAlert('Please fill in all general details (Reported By, Date/Time, Place, and Contact Details).', 'Validation Error', 'warning');
        return;
      }
      if (reportFor === 'Others' && !reportForEmployee) {
        showAlert('Please search and select the employee you are reporting on behalf of.', 'Validation Error', 'warning');
        return;
      }
    }
    if (currentStep === 2) {
      if (selectedTypes.length === 0) {
        showAlert('Please select at least one Incident Type.', 'Validation Error', 'warning');
        return;
      }
      if (!natureOfLoss) {
        showAlert('Please specify the Nature of Loss / Damage.', 'Validation Error', 'warning');
        return;
      }
      if (!natureOfCase) {
        showAlert('Please select the Nature of Case (expected resolution window).', 'Validation Error', 'warning');
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleAddFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setAttachedFiles(prev => {
      const next = [...prev];
      for (const file of incoming) {
        if (file.size > 15 * 1024 * 1024) {
          showAlert(`"${file.name}" exceeds the 15 MB per-file limit and was skipped.`, 'File Too Large', 'warning');
          continue;
        }
        if (!next.some(f => f.name === file.name && f.size === file.size)) {
          next.push(file);
        }
      }
      return next;
    });
  };

  const uploadAttachments = async (incidentId: string): Promise<number> => {
    if (!currentUser || attachedFiles.length === 0) return 0;
    let uploaded = 0;
    for (const file of attachedFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const res = await fetch(`/api/incidents/${incidentId}/attachments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-username': currentUser.username,
            'x-user-role': currentUser.role
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            dataBase64: dataUrl,
            category: 'reporter_document'
          })
        });
        const json = await res.json();
        if (json.success) uploaded++;
        else showAlert(`"${file.name}" could not be uploaded: ${json.error || json.message}`, 'Upload Failed', 'warning');
      } catch {
        showAlert(`"${file.name}" could not be uploaded.`, 'Upload Failed', 'warning');
      }
    }
    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formType === 'noc') {
      if (!reportedBy || !dateTime || !place || !contactDetails || selectedTypes.length === 0 || !nocBriefDetails) {
        showAlert('Please complete all required NOC flash notification fields.', 'Validation Error', 'warning');
        return;
      }
      if (!natureOfCase) {
        showAlert('Please select the Nature of Case (expected resolution window).', 'Validation Error', 'warning');
        return;
      }
      if (reportFor === 'Others' && !reportForEmployee) {
        showAlert('Please search and select the employee you are reporting on behalf of.', 'Validation Error', 'warning');
        return;
      }
    }

    const year = new Date().getFullYear();
    const randId = Math.floor(1000 + Math.random() * 9000);
    const refNo = `${formType === 'noc' ? 'NOC/' : ''}SEC/${year}/${randId}`;
    const registerNumber = `REG-${year}-${Math.floor(100 + Math.random() * 900)}`;

    const newIncident: SecurityIncident = {
      id: `inc-${Date.now()}`,
      refNo,
      registerNumber,
      incidentType: selectedTypes,
      otherIncidentTypeDetails: otherTypeDetails,
      department,
      contactDetails,
      dateTime: dateTime || new Date().toISOString(),
      place,
      province,
      lossValue: Number(lossValue) || 0,
      natureOfLoss: natureOfLoss || (formType === 'noc' ? 'Urgent NOC Flash Alert' : 'Standard Incident'),
      injuriesFatalities,
      reportedBy,
      reportFor,
      reportForEmployee: reportFor === 'Others' ? (reportForEmployee?.displayName || '') : '',
      sapsCaseNumber,
      policeStation,
      arrests: Number(arrests) || 0,
      classification,
      reportedToSapsSsa: reportedToSaps,
      outcomeOfInvestigation: formType === 'noc' ? 'NOC Flash Notification dispatched. National Operations Centre review active.' : 'New report submitted. Preliminary review pending.',
      status: 'Open',
      natureOfCase,
      workflowStage: 'Submitted',
      dateCreated: new Date().toISOString().split('T')[0],
      dateReported: new Date().toISOString().split('T')[0],

      whatHappened: formType === 'noc' ? `[NOC FLASH BRIEF] ${nocBriefDetails} (Duty Ref: ${nocDutyRef || 'Direct'})` : whatHappened,
      whereHappened: whereHappened || place,
      howHappened,
      whoResponsible,
      proceduresUsed,
      weaponsUsed,
      damageDone: damageDone || `R ${lossValue}`,
      actionTaken: actionTaken || (formType === 'noc' ? 'Immediate NOC Dispatch Alert sent' : ''),
      securityMeasuresEffectiveness,
      securityPersonnelReaction,
      otherAspects,
      lessonsLearned,
      recommendations
    };

    setGeneratedRefNo(refNo);
    setGeneratedRegNo(registerNumber);

    setIsSubmitting(true);
    try {
      const created = await onAddIncident(newIncident);
      if (!created) {
        showAlert('The incident could not be saved. Please try again.', 'Submission Failed', 'danger');
        return;
      }
      const uploaded = await uploadAttachments(newIncident.id);
      setUploadedCount(uploaded);
      setCurrentStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pill-style incident type selector with live "n selected" counter (handoff §5)
  const typePillSelector = (
    <div className="type-pills">
      {incidentTypes.map(type => {
        const selected = selectedTypes.includes(type);
        return (
          <button
            type="button"
            key={type}
            className={`type-pill ${selected ? 'selected' : ''}`}
            onClick={() => handleToggleType(type)}
          >
            {selected && <Check size={12} strokeWidth={3.5} />}
            {type}
          </button>
        );
      })}
    </div>
  );

  const selectedCountBadge = (
    <span className="selected-count-badge">{selectedTypes.length} selected</span>
  );

  // Supporting documents picker (FR-004) — shared by the standard and NOC forms
  const attachmentSection = (compact = false) => (
    <div className="form-group" style={{ marginTop: compact ? 0 : '1.25rem', marginBottom: 0 }}>
      <label className="form-label">Supporting Documents / Evidence {compact ? '' : '(photos, reports, statements)'}</label>
      <label className="dropzone" style={compact ? { padding: '11px', fontSize: '12.5px' } : undefined}>
        <UploadCloud size={compact ? 15 : 17} />
        <span>Click to attach files {compact ? '' : '(max 15 MB each — PDF, Office documents, images, audio/video)'}</span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          style={{ display: 'none' }}
          onChange={(e) => { handleAddFiles(e.target.files); e.target.value = ''; }}
        />
      </label>
      {attachedFiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
          {attachedFiles.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="attached-file-row">
              <Paperclip size={14} style={{ flexShrink: 0 }} />
              <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // "Report For" selector — shared by the standard and NOC forms
  const reportForSection = (
    <div className="form-group">
      <label className="form-label">Report For<RequiredStar /></label>
      <div style={{ display: 'flex', gap: '22px', padding: '9px 2px' }}>
        {(['Self', 'Others'] as const).map(option => (
          <label
            key={option}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            <input
              type="radio"
              name="reportFor"
              value={option}
              checked={reportFor === option}
              onChange={() => {
                setReportFor(option);
                if (option === 'Self') {
                  setReportForEmployee(null);
                  setEmployeeQuery('');
                  setEmployeeResults([]);
                }
              }}
              style={{ accentColor: 'var(--color-accent)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            {option === 'Self' ? 'Self' : 'Others (on behalf of an employee)'}
          </label>
        ))}
      </div>

      {reportFor === 'Others' && (
        reportForEmployee ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', padding: '10px 14px',
              background: 'var(--bg-subtle)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)'
            }}
          >
            <UserCheck size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{reportForEmployee.displayName}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {[reportForEmployee.persalNumber || reportForEmployee.username, reportForEmployee.jobTitle].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setReportForEmployee(null); setEmployeeQuery(''); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}
              aria-label="Clear selected employee"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <Search size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search employee by name or ID (e.g. PERSAL number)..."
              value={employeeQuery}
              onChange={(e) => setEmployeeQuery(e.target.value)}
            />
            {employeeQuery.trim().length >= 2 && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
                }}
              >
                {isSearchingEmployees ? (
                  <div style={{ padding: '11px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>Searching directory...</div>
                ) : employeeResults.length === 0 ? (
                  <div style={{ padding: '11px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>No matching employees found.</div>
                ) : (
                  employeeResults.map(emp => (
                    <button
                      type="button"
                      key={emp.username}
                      onClick={() => { setReportForEmployee(emp); setEmployeeResults([]); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                        background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{emp.displayName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {[emp.persalNumber || emp.username, emp.jobTitle, emp.province].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );

  const natureOfCaseSelect = (
    <div className="form-group">
      <label className="form-label">Nature of Case (expected resolution window)<RequiredStar /></label>
      <select className="form-input" value={natureOfCase} onChange={(e) => setNatureOfCase(e.target.value)} required>
        <option value="">Select expected timeframe</option>
        {NATURE_OF_CASE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

  return (
    <div className="screen-fade-up">
      {/* Header band with scheme/step kicker */}
      <div className="header-row">
        <div>
          <h1 className="page-title">Report Security Incident</h1>
          <p className="page-subtitle">File incident notifications directly to the National Operations Centre</p>
        </div>
        {currentStep < 4 && (
          <div className="header-band-kicker">
            <div className="kick">{formType === 'noc' ? 'Flash Dispatch Protocol' : `Step ${currentStep} of 3`}</div>
            <div className="head">{formType === 'noc' ? 'Direct NOC Alert Dispatch' : STEP_LABELS[currentStep - 1]}</div>
          </div>
        )}
      </div>

      {/* Scheme toggle + stepper card */}
      {currentStep < 4 && (
        <div className="chart-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div className="overline-label" style={{ marginBottom: '10px' }}>Form Notification Scheme</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={formType === 'standard' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '11px 18px', fontSize: '13px' }}
                  onClick={() => { setFormType('standard'); setCurrentStep(1); }}
                >
                  <FileText size={15} /> DLRRD Standard Form
                </button>
                <button
                  type="button"
                  className={formType === 'noc' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '11px 18px', fontSize: '13px' }}
                  onClick={() => { setFormType('noc'); }}
                >
                  <Shield size={15} /> NOC Initial Notification
                </button>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {formType === 'standard' && (
              <div className="stepper">
                {STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  const done = n < currentStep;
                  const current = n === currentStep;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="stepper-node">
                        <div className={`stepper-dot ${done ? 'done' : current ? 'current' : ''}`}>
                          {done ? <Check size={14} strokeWidth={3.5} /> : n}
                        </div>
                        <div className={`stepper-label ${done || current ? 'reached' : ''}`}>{label}</div>
                      </div>
                      {n < 3 && <div className={`stepper-line ${done ? 'done' : ''}`} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED NOC INITIAL NOTIFICATION FORM VIEW */}
      {formType === 'noc' && currentStep < 4 && (
        <form onSubmit={handleSubmit} className="chart-card form-step-panel" style={{ padding: '28px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <Shield size={20} color="var(--color-primary)" />
            <div className="form-step-title">NOC Initial Notification (National Operations Centre)</div>
            <div style={{ flex: 1 }} />
            <span className="protocol-pill amber">Flash Alert Dispatch</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Urgent flash incident dispatch form for immediate central monitoring in Pretoria HQ
          </div>

          <div className="amber-note" style={{ marginBottom: '24px' }}>
            <AlertTriangle size={17} />
            <div className="txt">
              <strong>Immediate Dispatch Mode:</strong> Submitting this NOC Initial Notification will generate an urgent reference code (<strong>NOC/SEC/{new Date().getFullYear()}/xxxx</strong>) and route a real-time notification to National Operations Centre supervisors.
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">NOC Duty Officer / Hotline Ref</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. NOC-HOTLINE-0800 / Desk 4"
                value={nocDutyRef}
                onChange={(e) => setNocDutyRef(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reporting Officer Name & Rank<RequiredStar /></label>
              <input
                type="text"
                className="form-input"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                required
              />
            </div>
          </div>

          {reportForSection}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Contact Details (Phone / Email)<RequiredStar /></label>
              <input
                type="text"
                className="form-input"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date and Time of Incident<RequiredStar /></label>
              <input
                type="datetime-local"
                className="form-input"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Place / Location of Incident<RequiredStar /></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Pretoria HQ, 4th Floor Server Room"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Province<RequiredStar /></label>
              <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value as ProvinceType)}>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Select Incident Type(s)<RequiredStar /></label>
              {selectedCountBadge}
            </div>
            {typePillSelector}
          </div>

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label">
              Initial Notification Report Brief Details (Comprehensive Summary for NOC)<RequiredStar />
            </label>
            <textarea
              rows={4}
              className="form-input"
              placeholder="Provide a concise summary of the security incident, names involved, immediate risks, and current status for NOC operational response..."
              value={nocBriefDetails}
              onChange={(e) => setNocBriefDetails(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-grid">
            {natureOfCaseSelect}
            {attachmentSection(true)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', gap: '12px' }}>
            <button type="button" className="btn btn-secondary btn-cancel-rust" onClick={() => setFormType('standard')} disabled={isSubmitting}>
              Cancel NOC Alert
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '13px 26px', fontWeight: 800 }} disabled={isSubmitting}>
              <Send size={15} strokeWidth={2.5} /> {isSubmitting ? 'Dispatching...' : 'Submit NOC Initial Notification'}
            </button>
          </div>
        </form>
      )}

      {/* STANDARD DLRRD MULTI-STEP FORM */}
      {formType === 'standard' && currentStep < 4 && (
        <form onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <div className="chart-card form-step-panel" style={{ padding: '28px 30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
                <div className="form-step-title">Step 1: General & Contact Information</div>
                <div style={{ flex: 1 }} />
                <span className="protocol-pill">Standard DLRRD Protocol</span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Department / Institution<RequiredStar /></label>
                  <input type="text" className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} required readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Reported By (Officer Name & Rank)<RequiredStar /></label>
                  <input type="text" className="form-input" placeholder="e.g. Snr Security Officer John Doe" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} required />
                </div>
              </div>

              {reportForSection}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Details (Tel / Email)<RequiredStar /></label>
                  <input type="text" className="form-input" placeholder="e.g. 012 312 8624 / john.doe@dlrrd.gov.za" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date and Time of Occurrence<RequiredStar /></label>
                  <input type="datetime-local" className="form-input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Place of Occurrence (Detailed Address / Office Room)<RequiredStar /></label>
                  <input type="text" className="form-input" placeholder="e.g. Pretoria HQ, 4th Floor Room 412" value={place} onChange={(e) => setPlace(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Province<RequiredStar /></label>
                  <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value as ProvinceType)}>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ maxWidth: '340px' }}>
                <label className="form-label">Security Classification Level (Initial)</label>
                <select className="form-input" value={classification} onChange={(e) => setClassification(e.target.value as SecurityIncident['classification'])}>
                  <option value="Unclassified">Unclassified</option>
                  <option value="Restricted">Restricted</option>
                  <option value="Confidential">Confidential</option>
                  <option value="Secret">Secret</option>
                  <option value="Top Secret">Top Secret</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
                <button type="button" className="btn btn-primary" style={{ padding: '13px 24px', fontSize: '14px' }} onClick={handleNextStep}>
                  Next Step: Categorization <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="chart-card form-step-panel" style={{ padding: '28px 30px' }}>
              <div className="form-step-title" style={{ marginBottom: '14px' }}>
                Step 2: Incident Categorization & Loss Details
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Incident Type (Select all that apply)<RequiredStar /></label>
                  {selectedCountBadge}
                </div>
                {typePillSelector}
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="form-label">If other incident types, please elaborate</label>
                <input type="text" className="form-input" placeholder="Elaborate details for 'other' selection" value={otherTypeDetails} onChange={(e) => setOtherTypeDetails(e.target.value)} />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Detailed Nature of Loss / Damage<RequiredStar /></label>
                  <textarea rows={3} className="form-input" placeholder="List stolen assets, details of damage, etc." value={natureOfLoss} onChange={(e) => setNatureOfLoss(e.target.value)} required style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Injuries or Fatalities Description</label>
                  <textarea rows={3} className="form-input" value={injuriesFatalities} onChange={(e) => setInjuriesFatalities(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Loss Value (Replacement value in Rands)<RequiredStar /></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13.5px', fontWeight: 800, color: 'var(--text-muted)' }}>R</span>
                    <input type="number" className="form-input" placeholder="0.00" style={{ paddingLeft: '32px' }} value={lossValue} onChange={(e) => setLossValue(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reported to SAPS or SSA?</label>
                  <select className="form-input" value={reportedToSaps} onChange={(e) => setReportedToSaps(e.target.value as SecurityIncident['reportedToSapsSsa'])}>
                    <option value="No">No</option>
                    <option value="Pending">Pending</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                {natureOfCaseSelect}
              </div>

              {reportedToSaps === 'Yes' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Police Station where reported</label>
                    <input type="text" className="form-input" placeholder="e.g. Pretoria Central Police Station" value={policeStation} onChange={(e) => setPoliceStation(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SAPS CAS Number</label>
                    <input type="text" className="form-input" placeholder="e.g. CAS 412/05/2026" value={sapsCaseNumber} onChange={(e) => setSapsCaseNumber(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '13px 22px', fontSize: '14px' }} onClick={handlePrevStep}>
                  <ArrowLeft size={15} strokeWidth={2.5} /> Back
                </button>
                <button type="button" className="btn btn-primary" style={{ padding: '13px 24px', fontSize: '14px' }} onClick={handleNextStep}>
                  Next Step: Narrative <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="chart-card form-step-panel" style={{ padding: '28px 30px' }}>
              <div className="form-step-title" style={{ marginBottom: '20px' }}>
                Step 3: Incident Narrative Report
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What happened?</label>
                    <textarea rows={3} className="form-input" placeholder="Describe the incident" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Where did it happen?</label>
                    <textarea rows={3} className="form-input" placeholder="Exact location" value={whereHappened} onChange={(e) => setWhereHappened(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did it happen?</label>
                    <textarea rows={3} className="form-input" placeholder="Sequence of events" value={howHappened} onChange={(e) => setHowHappened(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Who is responsible?</label>
                    <textarea rows={3} className="form-input" placeholder="Known or suspected persons" value={whoResponsible} onChange={(e) => setWhoResponsible(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What weapons were used (if any)?</label>
                    <textarea rows={2} className="form-input" placeholder="Firearms, tools, etc." value={weaponsUsed} onChange={(e) => setWeaponsUsed(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What security procedures were used?</label>
                    <textarea rows={2} className="form-input" placeholder="Protocols followed" value={proceduresUsed} onChange={(e) => setProceduresUsed(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What damage was done (include rand value)?</label>
                    <textarea rows={2} className="form-input" placeholder="Estimated damage" value={damageDone} onChange={(e) => setDamageDone(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any other aspects to report?</label>
                    <textarea rows={2} className="form-input" placeholder="Additional context" value={otherAspects} onChange={(e) => setOtherAspects(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did security personnel react to the incident?</label>
                    <textarea rows={2} className="form-input" placeholder="Response actions" value={securityPersonnelReaction} onChange={(e) => setSecurityPersonnelReaction(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">How effective were the existing security measures?</label>
                    <textarea rows={2} className="form-input" placeholder="Assessment" value={securityMeasuresEffectiveness} onChange={(e) => setSecurityMeasuresEffectiveness(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What was done about the incident? (Actions Taken)</label>
                  <textarea rows={2} className="form-input" placeholder="Immediate remediation" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} style={{ resize: 'vertical' }} />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What lessons can be learnt from the incident?</label>
                    <textarea rows={3} className="form-input" placeholder="Preventative insight" value={lessonsLearned} onChange={(e) => setLessonsLearned(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any recommendations?</label>
                    <textarea rows={3} className="form-input" placeholder="Suggested improvements" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              </div>

              {attachmentSection()}

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '28px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '13px 22px', fontSize: '14px' }} onClick={handlePrevStep} disabled={isSubmitting}>
                  <ArrowLeft size={15} strokeWidth={2.5} /> Back
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '13px 26px', fontSize: '14px' }} disabled={isSubmitting}>
                  <Send size={15} strokeWidth={2.5} /> {isSubmitting ? 'Submitting & Uploading...' : 'Submit Standard Incident Report'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* SUCCESS STATE */}
      {currentStep === 4 && (
        <div className="success-card">
          <div className="success-orb">
            <CheckCircle2 size={40} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: 0 }}>
            {formType === 'noc' ? 'NOC Flash Alert Dispatched' : 'Incident Report Submitted'}
          </h2>
          <div style={{ fontSize: '14px', color: '#5B6B63', marginTop: '8px' }}>
            Your reference number has been generated. Keep it for follow-up.
          </div>

          <div className="success-ref-tile">{generatedRefNo}</div>
          <div style={{ fontSize: '12.5px', color: '#8A978F', marginTop: '14px' }}>
            Official Register Number: <strong style={{ color: 'var(--text-secondary)' }}>{generatedRegNo}</strong>
          </div>

          <p style={{ fontSize: '13px', color: '#5B6B63', margin: '18px auto 0', maxWidth: '520px', lineHeight: 1.6 }}>
            {formType === 'noc'
              ? 'The NOC Flash Initial Notification has been immediately dispatched to the National Operations Centre emergency board.'
              : 'The incident report has been securely registered and auto-routed to your Provincial Security Coordinator and the National Office.'}
            {' '}A confirmation has been sent to you by email and in-app alert.
            {uploadedCount > 0 && ` ${uploadedCount} supporting document${uploadedCount === 1 ? '' : 's'} uploaded to the case file.`}
            {' '}You will be notified automatically as the case progresses.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '26px' }}>
            <button type="button" className="btn btn-primary" style={{ padding: '12px 22px' }} onClick={() => onNavigate('my_cases')}>
              Track My Incidents
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '12px 22px' }}
              onClick={() => { setFormType('standard'); setCurrentStep(1); setSelectedTypes([]); setNatureOfLoss(''); setLossValue(''); setNocBriefDetails(''); setNatureOfCase(''); setAttachedFiles([]); setUploadedCount(0); setReportFor('Self'); setReportForEmployee(null); setEmployeeQuery(''); setEmployeeResults([]); }}
            >
              Report Another Incident
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
