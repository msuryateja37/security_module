import React, { useState } from 'react';
import type { SecurityIncident, ProvinceType } from '../types/security';
import { NATURE_OF_CASE_OPTIONS } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { PROVINCES } from '../data/mockData';
import { Shield, FileText, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle, Paperclip, X, UploadCloud } from 'lucide-react';
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

  // Toggle incident type checkbox
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

  // Supporting documents picker (FR-004) — shared by the standard and NOC forms
  const attachmentSection = (
    <div className="form-group" style={{ marginTop: '1.25rem' }}>
      <label className="form-label">Supporting Documents / Evidence (photos, reports, statements)</label>
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.9rem 1rem',
          border: '1.5px dashed var(--border-color)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem'
        }}
      >
        <UploadCloud size={20} />
        <span>Click to attach files (max 15 MB each — PDF, Office documents, images, audio/video)</span>
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
            <div
              key={`${file.name}-${idx}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.75rem',
                background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.8rem'
              }}
            >
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

  const natureOfCaseSelect = (
    <div className="form-group">
      <label className="form-label">Nature of Case (expected resolution window) *</label>
      <select className="form-input" value={natureOfCase} onChange={(e) => setNatureOfCase(e.target.value)} required>
        <option value="">Select expected timeframe</option>
        {NATURE_OF_CASE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Report Security Incident</h1>
          <p className="page-subtitle">File incident notifications directly to the National Operations Centre</p>
        </div>
      </div>

      {currentStep < 4 && (
        <div className="glass-card step-banner">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Form Notification Scheme
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                type="button"
                className={`btn ${formType === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setFormType('standard'); setCurrentStep(1); }}
              >
                <FileText size={16} /> DLRRD Standard Form
              </button>
              <button 
                type="button"
                className={`btn ${formType === 'noc' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setFormType('noc'); }}
              >
                <Shield size={16} /> NOC Initial Notification
              </button>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {formType === 'standard' ? (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  STEP {currentStep} OF 3
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {currentStep === 1 && 'General & Contact Info'}
                  {currentStep === 2 && 'Incident Categorization & Loss'}
                  {currentStep === 3 && 'Incident Narrative Report'}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  FLASH DISPATCH PROTOCOL
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                  Direct NOC Alert Dispatch
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED NOC INITIAL NOTIFICATION FORM VIEW */}
      {formType === 'noc' && currentStep < 4 && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={22} color="var(--color-primary)" /> NOC Initial Notification (National Operations Centre)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Urgent flash incident dispatch form for immediate central monitoring in Pretoria HQ
              </p>
            </div>
            <span className="badge warning">
              Flash Alert Dispatch
            </span>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.875rem 1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="#b45309" />
            <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
              <strong>Immediate Dispatch Mode:</strong> Submitting this NOC Initial Notification will generate an urgent reference code (<strong>NOC/SEC/2026/xxxx</strong>) and route a real-time notification to National Operations Centre supervisors.
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
              <label className="form-label">Reporting Officer Name & Rank *</label>
              <input 
                type="text" 
                className="form-input" 
                value={reportedBy} 
                onChange={(e) => setReportedBy(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Contact Details (Phone / Email) *</label>
              <input 
                type="text" 
                className="form-input" 
                value={contactDetails} 
                onChange={(e) => setContactDetails(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date and Time of Incident *</label>
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
              <label className="form-label">Place / Location of Incident *</label>
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
              <label className="form-label">Province *</label>
              <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value as ProvinceType)}>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Select Incident Type(s) *</label>
            <div className="incident-types-grid">
              {incidentTypes.map(type => (
                <label key={type} className="checkbox-label">
                  <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => handleToggleType(type)} />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label">
              Initial Notification Report Brief Details (Comprehensive Summary for NOC) *
            </label>
            <textarea
              rows={4}
              className="form-input"
              placeholder="Provide a concise summary of the security incident, names involved, immediate risks, and current status for NOC operational response..."
              value={nocBriefDetails}
              onChange={(e) => setNocBriefDetails(e.target.value)}
              required
            />
          </div>

          <div className="form-grid">
            {natureOfCaseSelect}
          </div>

          {attachmentSection}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setFormType('standard')} disabled={isSubmitting}>
              Cancel NOC Alert
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Dispatching...' : 'Submit NOC Initial Notification'}
            </button>
          </div>
        </form>
      )}

      {/* STANDARD DLRRD MULTI-STEP FORM */}
      {formType === 'standard' && (
        <form onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Step 1: General & Contact Information</h3>
                <span className="badge muted">
                  Standard DLRRD Protocol
                </span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Department / Institution *</label>
                  <input type="text" className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Reported By (Officer Name & Rank) *</label>
                  <input type="text" className="form-input" placeholder="e.g. Snr Security Officer John Doe" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} required />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Details (Tel / Email) *</label>
                  <input type="text" className="form-input" placeholder="e.g. 012 312 8624 / john.doe@dlrrd.gov.za" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date and Time of Occurrence *</label>
                  <input type="datetime-local" className="form-input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Place of Occurrence (Detailed Address / Office Room) *</label>
                  <input type="text" className="form-input" placeholder="e.g. Pretoria HQ, 4th Floor Room 412" value={place} onChange={(e) => setPlace(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Province *</label>
                  <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value as ProvinceType)}>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label className="form-label">Security Classification Level (Initial)</label>
                <select className="form-input" value={classification} onChange={(e) => setClassification(e.target.value as SecurityIncident['classification'])}>
                  <option value="Unclassified">Unclassified</option>
                  <option value="Restricted">Restricted</option>
                  <option value="Confidential">Confidential</option>
                  <option value="Secret">Secret</option>
                  <option value="Top Secret">Top Secret</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-primary" onClick={handleNextStep}>
                  Next Step: Categorization <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                Step 2: Incident Categorization & Loss Details
              </h3>

              <div className="form-group">
                <label className="form-label">Incident Type (Select all that apply) *</label>
                <div className="incident-types-grid">
                  {incidentTypes.map(type => (
                    <label key={type} className="checkbox-label">
                      <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => handleToggleType(type)} />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">If other incident types, please elaborate</label>
                <input type="text" className="form-input" placeholder="Elaborate details for 'other' selection" value={otherTypeDetails} onChange={(e) => setOtherTypeDetails(e.target.value)} />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Detailed Nature of Loss / Damage *</label>
                  <textarea rows={3} className="form-input" placeholder="List stolen assets, details of damage, etc." value={natureOfLoss} onChange={(e) => setNatureOfLoss(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Injuries or Fatalities Description</label>
                  <textarea rows={3} className="form-input" value={injuriesFatalities} onChange={(e) => setInjuriesFatalities(e.target.value)} />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Loss Value (Replacement value in South African Rands R) *</label>
                  <input type="number" className="form-input" value={lossValue} onChange={(e) => setLossValue(e.target.value)} required />
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

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrevStep}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="btn btn-primary" onClick={handleNextStep}>
                  Next Step: Narrative <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                Step 3: Incident Narrative Report
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What happened?</label>
                    <textarea rows={3} className="form-input" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Where did it happen?</label>
                    <textarea rows={3} className="form-input" value={whereHappened} onChange={(e) => setWhereHappened(e.target.value)} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did it happen?</label>
                    <textarea rows={3} className="form-input" value={howHappened} onChange={(e) => setHowHappened(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Who is responsible?</label>
                    <textarea rows={3} className="form-input" value={whoResponsible} onChange={(e) => setWhoResponsible(e.target.value)} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What weapons were used (if any)?</label>
                    <textarea rows={2} className="form-input" value={weaponsUsed} onChange={(e) => setWeaponsUsed(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What security procedures were used?</label>
                    <textarea rows={2} className="form-input" value={proceduresUsed} onChange={(e) => setProceduresUsed(e.target.value)} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What damage was done (include rand value)?</label>
                    <textarea rows={2} className="form-input" value={damageDone} onChange={(e) => setDamageDone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any other aspects to report?</label>
                    <textarea rows={2} className="form-input" value={otherAspects} onChange={(e) => setOtherAspects(e.target.value)} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did security personnel react to the incident?</label>
                    <textarea rows={2} className="form-input" value={securityPersonnelReaction} onChange={(e) => setSecurityPersonnelReaction(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">How effective were the existing security measures?</label>
                    <textarea rows={2} className="form-input" value={securityMeasuresEffectiveness} onChange={(e) => setSecurityMeasuresEffectiveness(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What was done about the incident? (Actions Taken)</label>
                  <textarea rows={2} className="form-input" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What lessons can be learnt from the incident?</label>
                    <textarea rows={3} className="form-input" value={lessonsLearned} onChange={(e) => setLessonsLearned(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any recommendations?</label>
                    <textarea rows={3} className="form-input" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
                  </div>
                </div>
              </div>

              {attachmentSection}

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrevStep} disabled={isSubmitting}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn-success" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting & Uploading...' : 'Submit Standard Incident Report'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {currentStep === 4 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
          <CheckCircle2 size={64} color="hsl(var(--color-success))" style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 style={{ marginBottom: '0.75rem' }}>{formType === 'noc' ? 'NOC Flash Notification Dispatched' : 'Incident Report Logged'}</h2>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Reference Number (Case ID)</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'hsl(var(--color-accent))' }}>{generatedRefNo}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Official Register Number</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{generatedRegNo}</span>
            </div>
          </div>

          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '0.75rem' }}>
            {formType === 'noc'
              ? 'The NOC Flash Initial Notification has been immediately dispatched to the National Operations Centre emergency board.'
              : 'The incident report has been securely registered and auto-routed to your Provincial Security Coordinator and the National Office.'}
          </p>
          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem', fontSize: '0.85rem' }}>
            A confirmation has been sent to you by email and in-app alert.
            {uploadedCount > 0 && ` ${uploadedCount} supporting document${uploadedCount === 1 ? '' : 's'} uploaded to the case file.`}
            {' '}You will be notified automatically as the case progresses.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('my_cases')}>
              Track My Incident
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setFormType('standard'); setCurrentStep(1); setSelectedTypes([]); setNatureOfLoss(''); setLossValue(''); setNocBriefDetails(''); setNatureOfCase(''); setAttachedFiles([]); setUploadedCount(0); }}>
              Log Another Incident
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
