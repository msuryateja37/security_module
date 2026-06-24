import React, { useState } from 'react';
import type { SecurityIncident, ProvinceType } from '../types/security';
import { PROVINCES } from '../data/mockData';
import { Shield, FileText, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface ReportIncidentViewProps {
  onAddIncident: (incident: SecurityIncident) => void;
  onNavigate: (view: string) => void;
}

const INCIDENT_TYPES_LIST = [
  'Loss of information', 'Armed Robbery', 'Violence (workplace)', 'Conflict of interest', 
  'Malicious damage to property', 'Trespassing', 'Bomb Threat', 'Robbery', 'Fraud', 
  'Extortion', 'Sabotage', 'Drugs', 'Harassment', 'Assault', 'Theft', 'Kidnapping', 
  'Arson', 'Pouching', 'Accidental Discharge of a firearm', 'Acts of terrorism / terror', 
  'Violation of permit system', 'Fire', 'Explosion', 'Hostage situation', 'Firearm related', 
  'Permit related', 'Firearm left unattended', 'Accidental damage to property'
];

export const ReportIncidentView: React.FC<ReportIncidentViewProps> = ({ onAddIncident, onNavigate }) => {
  const [formType, setFormType] = useState<'standard' | 'noc'>('standard');
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form fields state
  const [department, setDepartment] = useState('Chief Directorate: Security and Facilities Management Services');
  const [contactDetails, setContactDetails] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [place, setPlace] = useState('');
  const [province, setProvince] = useState<ProvinceType>('Gauteng');
  const [lossValue, setLossValue] = useState(0);
  const [natureOfLoss, setNatureOfLoss] = useState('');
  const [injuriesFatalities, setInjuriesFatalities] = useState('None');
  const [reportedBy, setReportedBy] = useState('Supervisor');
  const [sapsCaseNumber, setSapsCaseNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [arrests, setArrests] = useState(0);
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

  // Toggle incident type checkbox
  const handleToggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleNextStep = () => {
    // Basic validation
    if (currentStep === 1) {
      if (!reportedBy || !dateTime || !place || !contactDetails) {
        alert('Please fill in all general details (Reported By, Date/Time, Place, and Contact Details).');
        return;
      }
    }
    if (currentStep === 2) {
      if (selectedTypes.length === 0) {
        alert('Please select at least one Incident Type.');
        return;
      }
      if (!natureOfLoss) {
        alert('Please specify the Nature of Loss / Damage.');
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
    
    // Generate unique incident references
    const year = new Date().getFullYear();
    const randId = Math.floor(1000 + Math.random() * 9000);
    const refNo = `${formType === 'noc' ? 'NOC' : 'DLRRD'}/SEC/${year}/${randId}`;
    const registerNumber = `REG-${year}-${Math.floor(100 + Math.random() * 900)}`;

    const newIncident: SecurityIncident = {
      id: `inc-${Date.now()}`,
      refNo,
      registerNumber,
      incidentType: selectedTypes,
      otherIncidentTypeDetails: otherTypeDetails,
      department,
      contactDetails,
      dateTime,
      place,
      province,
      lossValue,
      natureOfLoss,
      injuriesFatalities,
      reportedBy,
      sapsCaseNumber,
      policeStation,
      arrests,
      classification,
      reportedToSapsSsa: reportedToSaps,
      outcomeOfInvestigation: 'New report submitted. Preliminary review pending.',
      status: 'Open',
      dateCreated: new Date().toISOString().split('T')[0],
      dateReported: new Date().toISOString().split('T')[0],
      
      // Narrative details
      whatHappened: formType === 'noc' ? nocBriefDetails : whatHappened,
      whereHappened: whereHappened || place,
      howHappened,
      whoResponsible,
      proceduresUsed,
      weaponsUsed,
      damageDone: damageDone || `R ${lossValue}`,
      actionTaken,
      securityMeasuresEffectiveness,
      securityPersonnelReaction,
      otherAspects,
      lessonsLearned,
      recommendations
    };

    onAddIncident(newIncident);
    setCurrentStep(4); // Success step
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Report Security Breach</h1>
          <p className="page-subtitle">File incident notifications directly to the National Operations Centre</p>
        </div>
      </div>

      {currentStep < 4 && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>FORM NOTIFICATION SCHEME</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                className={`btn ${formType === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => { setFormType('standard'); setCurrentStep(1); }}
                disabled={currentStep > 1}
              >
                <FileText size={16} /> DLRRD Standard Form
              </button>
              <button 
                className={`btn ${formType === 'noc' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                onClick={() => { setFormType('noc'); setCurrentStep(1); }}
                disabled={currentStep > 1}
              >
                <Shield size={16} /> NOC Initial Notification
              </button>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>STEP {currentStep} OF 3</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--color-primary))' }}>
              {currentStep === 1 && 'General & Contact Info'}
              {currentStep === 2 && 'Incident Categorization & Loss'}
              {currentStep === 3 && 'Incident Narrative Report'}
            </div>
          </div>
        </div>
      )}

      {/* Steps Form Container */}
      <form onSubmit={handleSubmit}>
        {currentStep === 1 && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              Step 1: General & Contact Information
            </h3>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Department / Institution *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reported By (Officer Name & Rank) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Snr Security Officer John Doe" 
                  value={reportedBy} 
                  onChange={(e) => setReportedBy(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Contact Details (Tel / Email) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 012 312 8624 / john.doe@dlrrd.gov.za" 
                  value={contactDetails} 
                  onChange={(e) => setContactDetails(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date and Time of Occurrence *</label>
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
                <label className="form-label">Place of Occurrence (Detailed Address / Office Room) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Pretoria HQ, 4th Floor Room 412" 
                  value={place} 
                  onChange={(e) => setPlace(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Province *</label>
                <select 
                  className="form-input" 
                  value={province} 
                  onChange={(e) => setProvince(e.target.value as ProvinceType)}
                >
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label className="form-label">Security Classification Level (Initial)</label>
              <select 
                className="form-input" 
                value={classification} 
                onChange={(e) => setClassification(e.target.value as SecurityIncident['classification'])}
              >
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
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              Step 2: Incident Categorization & Loss Details
            </h3>

            <div className="form-group">
              <label className="form-label">Incident Type (Select all that apply) *</label>
              <div className="incident-types-grid">
                {INCIDENT_TYPES_LIST.map(type => (
                  <label key={type} className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={selectedTypes.includes(type)} 
                      onChange={() => handleToggleType(type)} 
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">If other incident types, please elaborate</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Elaborate details for 'other' selection" 
                value={otherTypeDetails}
                onChange={(e) => setOtherTypeDetails(e.target.value)}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Detailed Nature of Loss / Damage *</label>
                <textarea 
                  rows={3} 
                  className="form-input" 
                  placeholder="List stolen assets, details of damage, etc." 
                  value={natureOfLoss}
                  onChange={(e) => setNatureOfLoss(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Injuries or Fatalities Description</label>
                <textarea 
                  rows={3} 
                  className="form-input" 
                  value={injuriesFatalities}
                  onChange={(e) => setInjuriesFatalities(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Loss Value (Replacement value in South African Rands R) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={lossValue} 
                  onChange={(e) => setLossValue(parseInt(e.target.value) || 0)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reported to SAPS or SSA?</label>
                <select 
                  className="form-input" 
                  value={reportedToSaps} 
                  onChange={(e) => setReportedToSaps(e.target.value as SecurityIncident['reportedToSapsSsa'])}
                >
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
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Pretoria Central Police Station" 
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SAPS CAS Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. CAS 123/05/2026" 
                    value={sapsCaseNumber}
                    onChange={(e) => setSapsCaseNumber(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2', maxWidth: '300px' }}>
                  <label className="form-label">Number of arrests (if any)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={arrests}
                    onChange={(e) => setArrests(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%', marginTop: '2rem' }}>
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
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              Step 3: Incident Narrative Report
            </h3>

            {formType === 'noc' ? (
              // NOC Brief Notification style
              <div className="form-group">
                <label className="form-label">
                  INITIAL NOTIFICATION REPORT BRIEF DETAILS (Include names, contact details and relevance of incident) *
                </label>
                <textarea 
                  rows={8} 
                  className="form-input" 
                  placeholder="Provide a comprehensive summary for immediate NOC notification..." 
                  value={nocBriefDetails}
                  onChange={(e) => setNocBriefDetails(e.target.value)}
                  required 
                />
              </div>
            ) : (
              // Standard Form Multi-questions style
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What happened?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={whatHappened}
                      onChange={(e) => setWhatHappened(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Where did it happen?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={whereHappened}
                      onChange={(e) => setWhereHappened(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did it happen?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={howHappened}
                      onChange={(e) => setHowHappened(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Who was responsible?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={whoResponsible}
                      onChange={(e) => setWhoResponsible(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What weapons and equipment were used?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={weaponsUsed}
                      onChange={(e) => setWeaponsUsed(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What procedures & techniques were used by perpetrators?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={proceduresUsed}
                      onChange={(e) => setProceduresUsed(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What damage was done (include rand value)?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={damageDone}
                      onChange={(e) => setDamageDone(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any other aspects to report?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={otherAspects}
                      onChange={(e) => setOtherAspects(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">How did security personnel react to the incident?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={securityPersonnelReaction}
                      onChange={(e) => setSecurityPersonnelReaction(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">How effective were the existing security measures?</label>
                    <textarea 
                      rows={2} 
                      className="form-input" 
                      value={securityMeasuresEffectiveness}
                      onChange={(e) => setSecurityMeasuresEffectiveness(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What was done about the incident? (Actions Taken)</label>
                  <textarea 
                    rows={2} 
                    className="form-input" 
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)} 
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">What lessons can be learnt from the incident?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={lessonsLearned}
                      onChange={(e) => setLessonsLearned(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Any recommendations?</label>
                    <textarea 
                      rows={3} 
                      className="form-input" 
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifySelf: 'space-between', width: '100%', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handlePrevStep}>
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" className="btn btn-success">
                Submit Report to NOC
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
            <CheckCircle2 size={64} color="hsl(var(--color-success))" style={{ margin: '0 auto 1.5rem auto' }} />
            <h2 style={{ marginBottom: '0.75rem' }}>Breach Notification Logged</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem' }}>
              The incident report has been securely registered in the Case Management database and pushed to the National Operations Centre (NOC).
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('register')}>
                Open Case Files
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setCurrentStep(1); setSelectedTypes([]); setNatureOfLoss(''); setLossValue(0); setReportedToSaps('No'); }}>
                Log Another Incident
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
