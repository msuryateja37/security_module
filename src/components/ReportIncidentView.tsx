import React, { useState } from 'react';
import type { SecurityIncident, ProvinceType } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { PROVINCES } from '../data/mockData';
import { Shield, FileText, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useModal } from './NotificationModal';

interface ReportIncidentViewProps {
  onAddIncident: (incident: SecurityIncident) => void;
  onNavigate: (view: string) => void;
  currentUser?: UserProfile;
}

const INCIDENT_TYPES_LIST = [
  'Loss of information', 'Armed Robbery', 'Violence (workplace)', 'Conflict of interest', 
  'Malicious damage to property', 'Trespassing', 'Bomb Threat', 'Robbery', 'Fraud', 
  'Extortion', 'Sabotage', 'Drugs', 'Harassment', 'Assault', 'Theft', 'Kidnapping', 
  'Arson', 'Pouching', 'Accidental Discharge of a firearm', 'Acts of terrorism / terror', 
  'Violation of permit system', 'Fire', 'Explosion', 'Hostage situation', 'Firearm related', 
  'Permit related', 'Firearm left unattended', 'Accidental damage to property'
];

export const ReportIncidentView: React.FC<ReportIncidentViewProps> = ({ onAddIncident, onNavigate, currentUser }) => {
  const [formType, setFormType] = useState<'standard' | 'noc'>('standard');
  const [currentStep, setCurrentStep] = useState(1);
  const { showAlert } = useModal();
  const defaultProvince = currentUser?.province && PROVINCES.includes(currentUser.province as ProvinceType)
    ? currentUser.province as ProvinceType
    : 'Gauteng';
  
  // Form fields state
  const [department, setDepartment] = useState('Chief Directorate: Security and Facilities Management Services');
  const [contactDetails, setContactDetails] = useState(currentUser?.email || '');
  const [dateTime, setDateTime] = useState('');
  const [place, setPlace] = useState('');
  const [province, setProvince] = useState<ProvinceType>(defaultProvince);
  const [lossValue, setLossValue] = useState<string | number>('');
  const [natureOfLoss, setNatureOfLoss] = useState('');
  const [injuriesFatalities, setInjuriesFatalities] = useState('None');
  const [reportedBy, setReportedBy] = useState(currentUser?.displayName || '');
  const [sapsCaseNumber, setSapsCaseNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [arrests] = useState<string | number>('');
  const [classification, setClassification] = useState<SecurityIncident['classification']>('Unclassified');
  const [reportedToSaps, setReportedToSaps] = useState<SecurityIncident['reportedToSapsSsa']>('No');
  
  // Selected incident types
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [otherTypeDetails, setOtherTypeDetails] = useState('');

  // Narrative steps
  const [whatHappened, setWhatHappened] = useState('');
  const [whereHappened, setWhereHappened] = useState('');
  const [howHappened, setHowHappened] = useState('');
  const [whoResponsible, setWhoResponsible] = useState('');
  const [proceduresUsed, setProceduresUsed] = useState('');
  const [weaponsUsed, setWeaponsUsed] = useState('');
  const [damageDone, setDamageDone] = useState('');
  const [actionTaken, setActionTaken] = useState('');
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
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formType === 'noc') {
      if (!reportedBy || !dateTime || !place || !contactDetails || selectedTypes.length === 0 || !nocBriefDetails) {
        showAlert('Please complete all required NOC flash notification fields.', 'Validation Error', 'warning');
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

    onAddIncident(newIncident);
    setCurrentStep(4);
  };

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
              {INCIDENT_TYPES_LIST.map(type => (
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setFormType('standard')}>
              Cancel NOC Alert
            </button>
            <button type="submit" className="btn btn-primary">
              Submit NOC Initial Notification
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
                  {INCIDENT_TYPES_LIST.map(type => (
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

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrevStep}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn-success">
                  Submit Standard Incident Report
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

          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem' }}>
            {formType === 'noc' 
              ? 'The NOC Flash Initial Notification has been immediately dispatched to the National Operations Centre emergency board.'
              : 'The incident report has been securely registered in the Case Management database and pushed to regional coordinators.'}
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('register')}>
              Open Case Files
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setFormType('standard'); setCurrentStep(1); setSelectedTypes([]); setNatureOfLoss(''); setLossValue(''); setNocBriefDetails(''); }}>
              Log Another Incident
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
