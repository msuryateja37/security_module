import React, { useState, useMemo } from 'react';
import type { TraAudit } from '../types/security';
import { Save, Check, Pen } from 'lucide-react';
import { useModal } from './NotificationModal';

interface TraChecklistViewProps {
  reports: TraAudit[];
  onSubmitReport: (newReport: TraAudit) => void;
  currentUser?: any;
}

// 52-item digital checklist ordered exactly per design mockups (TRA.png, TRA (2).png, TRA (3).png)
const SECTION_A_ITEMS = [
  { id: 'a1', number: 1, label: 'All personnel vetted' },
  { id: 'a6', number: 2, label: 'Positive ID of visitors and contractors' },
  { id: 'a2', number: 3, label: 'Document security in place (registers and forms)' },
  { id: 'a7', number: 4, label: 'Secure storage of classified information' },
  { id: 'a3', number: 5, label: 'Classification system' },
  { id: 'a8', number: 6, label: 'Categorising of information' },
  { id: 'a4', number: 7, label: 'Secure transportation of classified information' },
  { id: 'a9', number: 8, label: 'Secure transmission of classified information' },
  { id: 'a5', number: 9, label: 'Control of destruction of classified information' },
  { id: 'a10', number: 10, label: 'Register for control of making copies' }
];

const SECTION_B_ITEMS = [
  { id: 'b1', number: 11, label: 'Security control room in place' },
  { id: 'b2', number: 12, label: 'Security control room has registers in place' },
  { id: 'b3', number: 13, label: 'Security control room has sufficient equipment' },
  { id: 'b4', number: 14, label: 'Security control room has sufficient communication equipment' },
  { id: 'b5', number: 15, label: 'Site floor plans available in control room' },
  { id: 'b6', number: 16, label: 'Access control — intruder detection, perimeter protection, lighting' },
  { id: 'b7', number: 17, label: 'Intruder alarm system in place' },
  { id: 'b8', number: 18, label: 'Security equipment at all access/egress points' },
  { id: 'b9', number: 19, label: 'CCTV in place — especially at access/egress points' },
  { id: 'b10', number: 20, label: 'CCTV cameras positioned correctly' },
  { id: 'b11', number: 21, label: 'CCTV cameras in working condition' },
  { id: 'b12', number: 22, label: 'CCTV systems regularly maintained and tested' },
  { id: 'b13', number: 23, label: 'Security personnel registered with PSIRA' },
  { id: 'b14', number: 24, label: 'Establishment of security committee' },
  { id: 'b15', number: 25, label: 'Security assessment by SSA done' },
  { id: 'b16', number: 26, label: 'Record of previous breaches' },
  { id: 'b17', number: 27, label: 'Burglar proofing in sensitive areas' },
  { id: 'b18', number: 28, label: 'External doors and frames in line with specifications' },
  { id: 'b19', number: 29, label: 'Key registers in place' },
  { id: 'b20', number: 30, label: 'Duplicate keys stored in safe place and accounted for' },
  { id: 'b21', number: 31, label: 'Security locks on doors' },
  { id: 'b22', number: 32, label: 'Security patrols done around perimeter' },
  { id: 'b23', number: 33, label: 'Vehicle registers in place' },
  { id: 'b24', number: 34, label: 'Vehicles and trucks entering the premises are searched' },
  { id: 'b25', number: 35, label: 'Facility security zoned' },
  { id: 'b26', number: 36, label: 'Control of prohibited items — register in place' }
];

const SECTION_C_ITEMS = [
  { id: 'c1', number: 37, label: 'Contingency plan in place' },
  { id: 'c2', number: 38, label: 'Evacuation plan correctly displayed' },
  { id: 'c3', number: 39, label: 'Emergency team details displayed' },
  { id: 'c4', number: 40, label: 'First Aid box available and mounted' },
  { id: 'c5', number: 41, label: 'Evacuation chair available and mounted' },
  { id: 'c6', number: 42, label: 'All exit routes unobstructed' },
  { id: 'c7', number: 43, label: 'Emergency exit design is suitable and functioning' },
  { id: 'c8', number: 44, label: 'Emergency drill conducted' },
  { id: 'c9', number: 45, label: 'Generator/UPS in place' },
  { id: 'c10', number: 46, label: 'Generator service' },
  { id: 'c11', number: 47, label: 'Generator tested last' },
  { id: 'c12', number: 48, label: 'Sufficient fire fighting aids' },
  { id: 'c13', number: 49, label: 'Servicing of fire extinguishers' },
  { id: 'c14', number: 50, label: 'OHS signage erected' },
  { id: 'c15', number: 51, label: 'Ablution facilities' },
  { id: 'c16', number: 52, label: 'Facilities for persons with disabilities' }
];

const ALL_CHECKLIST_ITEMS = [...SECTION_A_ITEMS, ...SECTION_B_ITEMS, ...SECTION_C_ITEMS];

export const TraChecklistView: React.FC<TraChecklistViewProps> = ({ reports, onSubmitReport, currentUser }) => {
  const { showAlert } = useModal();
  const [viewingReport, setViewingReport] = useState<TraAudit | null>(null);

  // Form states
  const [officeName, setOfficeName] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [assessorName, setAssessorName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [managerName, setManagerName] = useState('');
  const [assessorSignature, setAssessorSignature] = useState('');
  const [managerSignature, setManagerSignature] = useState('');

  // Local checklist state: itemId -> { status, notes }
  const [checklistValues, setChecklistValues] = useState<{
    [itemId: string]: {
      status?: 'Compliant' | 'Non-Compliant' | 'N/A';
      notes: string;
    };
  }>({});

  // Real-time compliance calculations
  const compliantCount = useMemo(() => {
    return ALL_CHECKLIST_ITEMS.filter(item => checklistValues[item.id]?.status === 'Compliant').length;
  }, [checklistValues]);

  const nonCompliantCount = useMemo(() => {
    return ALL_CHECKLIST_ITEMS.filter(item => checklistValues[item.id]?.status === 'Non-Compliant').length;
  }, [checklistValues]);

  const naCount = useMemo(() => {
    return ALL_CHECKLIST_ITEMS.filter(item => checklistValues[item.id]?.status === 'N/A').length;
  }, [checklistValues]);

  const completedCount = compliantCount + nonCompliantCount + naCount;
  const completionPercentage = Math.round((completedCount / ALL_CHECKLIST_ITEMS.length) * 100);

  const handleRadioChange = (itemId: string, status: 'Compliant' | 'Non-Compliant' | 'N/A') => {
    setChecklistValues(prev => ({
      ...prev,
      [itemId]: {
        status,
        notes: prev[itemId]?.notes || ''
      }
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setChecklistValues(prev => ({
      ...prev,
      [itemId]: {
        status: prev[itemId]?.status,
        notes
      }
    }));
  };

  // Digital signature helper format: 'Name|Date'
  const parseSignature = (sigStr: string) => {
    if (!sigStr) return { signed: false, name: '', date: '' };
    const parts = sigStr.split('|');
    if (parts.length === 2) {
      return { signed: true, name: parts[0], date: parts[1] };
    }
    return { signed: true, name: sigStr, date: '' };
  };

  const handleSignAssessor = () => {
    const name = assessorName || (currentUser?.displayName) || 'Assessor';
    if (!assessorName) {
      setAssessorName(name);
    }
    const today = new Date();
    const dateSlash = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    setAssessorSignature(`${name}|${dateSlash}`);
  };

  const handleSignManager = () => {
    const name = managerName || 'Manager';
    if (!managerName) {
      setManagerName(name);
    }
    const today = new Date();
    const dateSlash = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    setManagerSignature(`${name}|${dateSlash}`);
  };

  const handleViewReport = (rep: TraAudit) => {
    setViewingReport(rep);
    setOfficeName(rep.officeName);
    setOfficeLocation(rep.officeLocation);
    setAssessorName(rep.assessorName);
    setDate(rep.date);
    setTime(rep.time);
    setManagerName(rep.managerName);
    setAssessorSignature(rep.assessorSignature);
    setManagerSignature(rep.managerSignature);

    const localVals: typeof checklistValues = {};
    Object.entries(rep.checklistValues || {}).forEach(([itemId, val]) => {
      localVals[itemId] = {
        status: val.status,
        notes: val.notes
      };
    });
    setChecklistValues(localVals);
  };

  const handleCloseViewReport = () => {
    setViewingReport(null);
    setOfficeName('');
    setOfficeLocation('');
    setAssessorName('');
    setDate('');
    setTime('');
    setManagerName('');
    setAssessorSignature('');
    setManagerSignature('');
    setChecklistValues({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName || !date || !assessorName) {
      showAlert('Please fill in required fields (Office Name, Date, and Assessor Name).', 'Validation Error', 'warning');
      return;
    }

    if (!assessorSignature) {
      showAlert('Please sign the assessor block digitally before submitting.', 'Signature Required', 'warning');
      return;
    }

    const formattedValues: {
      [itemId: string]: {
        status: 'Compliant' | 'Non-Compliant' | 'N/A';
        notes: string;
      }
    } = {};

    ALL_CHECKLIST_ITEMS.forEach(item => {
      const val = checklistValues[item.id] || { status: 'Compliant', notes: '' };
      formattedValues[item.id] = {
        status: val.status || 'Compliant',
        notes: val.notes || ''
      };
    });

    const report: TraAudit = {
      id: `tra-${Date.now()}`,
      officeName,
      date,
      assessorName,
      officeLocation,
      time,
      managerName,
      assessorSignature,
      managerSignature,
      checklistValues: formattedValues,
      dateCreated: new Date().toISOString().split('T')[0]
    };

    onSubmitReport(report);
    handleCloseViewReport();
    showAlert('Threat and Risk Assessment checklist submitted successfully.', 'Checklist Submitted', 'success');
  };

  const assessorSig = parseSignature(assessorSignature);
  const managerSig = parseSignature(managerSignature);

  const renderChecklistItem = (item: typeof ALL_CHECKLIST_ITEMS[0]) => {
    const val = checklistValues[item.id] || { status: undefined, notes: '' };
    const isChecked = (status: 'Compliant' | 'Non-Compliant' | 'N/A') => val.status === status;

    return (
      <div 
        key={item.id} 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.8fr 1.2fr 1fr', 
          alignItems: 'center', 
          gap: '1.5rem', 
          paddingBottom: '1rem', 
          borderBottom: '1px solid #f3f4f6' 
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Item {item.number}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: viewingReport ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input 
              type="radio" 
              name={`status-${item.id}`} 
              checked={isChecked('Compliant')} 
              onChange={() => !viewingReport && handleRadioChange(item.id, 'Compliant')}
              disabled={!!viewingReport}
            />
            Yes
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: viewingReport ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input 
              type="radio" 
              name={`status-${item.id}`} 
              checked={isChecked('Non-Compliant')} 
              onChange={() => !viewingReport && handleRadioChange(item.id, 'Non-Compliant')}
              disabled={!!viewingReport}
            />
            No
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: viewingReport ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <input 
              type="radio" 
              name={`status-${item.id}`} 
              checked={isChecked('N/A')} 
              onChange={() => !viewingReport && handleRadioChange(item.id, 'N/A')}
              disabled={!!viewingReport}
            />
            N/A
          </label>
        </div>
        <div>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Comments..." 
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            value={val.notes || ''} 
            onChange={(e) => !viewingReport && handleNotesChange(item.id, e.target.value)}
            disabled={!!viewingReport}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="screen-fade-up">
      <div className="header-row" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Threat & Risk Assessment (TRA)</h1>
          <p className="page-subtitle">53-item digital checklist &bull; MPSS 2009 & MISS 1996 aligned</p>
        </div>
      </div>

      {viewingReport && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Viewing Signed Record: {viewingReport.officeLocation || viewingReport.officeName} (Read-Only)
          </span>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
            onClick={handleCloseViewReport}
          >
            Close View
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Assessment Details Box */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>Assessment Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Office Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter"
                value={officeName} 
                onChange={(e) => setOfficeName(e.target.value)} 
                disabled={!!viewingReport}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Office Location</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter"
                value={officeLocation} 
                onChange={(e) => setOfficeLocation(e.target.value)} 
                disabled={!!viewingReport}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Assessor Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter"
                value={assessorName} 
                onChange={(e) => setAssessorName(e.target.value)} 
                disabled={!!viewingReport}
                required 
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                disabled={!!viewingReport}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Time</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter"
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                disabled={!!viewingReport}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Manager Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter"
                value={managerName} 
                onChange={(e) => setManagerName(e.target.value)} 
                disabled={!!viewingReport}
              />
            </div>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Completion</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{completedCount} / 52</span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ background: '#31b399', height: '100%', width: `${completionPercentage}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ background: '#EEF7F2', color: '#1D8A50', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '4px' }}>
              {compliantCount} compliant
            </span>
            <span style={{ background: '#FDF2F0', color: '#C94C38', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '4px' }}>
              {nonCompliantCount} non-compliant
            </span>
          </div>
        </div>

        {/* Section A */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Information & Personnel Security</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {SECTION_A_ITEMS.map(item => renderChecklistItem(item))}
          </div>
        </div>

        {/* Section B */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Physical Security</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {SECTION_B_ITEMS.map(item => renderChecklistItem(item))}
          </div>
        </div>

        {/* Section C */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Occupational Health & Safety</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {SECTION_C_ITEMS.map(item => renderChecklistItem(item))}
          </div>
        </div>

        {/* Signatures card */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ border: '1px dashed #d1d5db', borderRadius: '6px', padding: '1.25rem', textAlign: 'center', background: '#f9fafb' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Assessor Signature</h4>
            {assessorSig.signed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'cursive' }}>{assessorSig.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed digitally{assessorSig.date ? ` on ${assessorSig.date}` : ''}</span>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}><Check size={12} /> Verified</span>
              </div>
            ) : (
              <button
                type="button"
                className="coord-btn coord-btn--outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                onClick={handleSignAssessor}
              >
                <Pen size={12} /> Sign digitally
              </button>
            )}
          </div>

          <div style={{ border: '1px dashed #d1d5db', borderRadius: '6px', padding: '1.25rem', textAlign: 'center', background: '#f9fafb' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Manager Signature</h4>
            {managerSig.signed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'cursive' }}>{managerSig.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed digitally{managerSig.date ? ` on ${managerSig.date}` : ''}</span>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}><Check size={12} /> Verified</span>
              </div>
            ) : (
              <button
                type="button"
                className="coord-btn coord-btn--outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                onClick={handleSignManager}
              >
                <Pen size={12} /> Sign digitally
              </button>
            )}
          </div>
        </div>

        {/* Submit / Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '2px solid #eaebeb', paddingTop: '1.5rem', gap: '1rem' }}>
          {viewingReport ? (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '0.65rem 2.5rem', fontWeight: 700, borderRadius: '4px' }}
              onClick={handleCloseViewReport}
            >
              Close View
            </button>
          ) : (
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: '0.65rem 2.5rem', background: '#31b399', fontWeight: 700, borderRadius: '4px' }}
            >
              <Save size={16} /> Submit TRA
            </button>
          )}
        </div>
      </form>

      {/* Signed Records history panel */}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Signed Records</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {reports.length} assessment{reports.length === 1 ? '' : 's'} on file
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.map(rep => {
            const assessorSigObj = parseSignature(rep.assessorSignature);
            const managerSigObj = parseSignature(rep.managerSignature);
            const assessorSigned = assessorSigObj.signed;
            const managerSigned = managerSigObj.signed;

            return (
              <div 
                key={rep.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '1rem', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '6px', 
                  background: '#f9fafb',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                onClick={() => handleViewReport(rep)}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-primary)' }}>{rep.officeLocation || rep.officeName || 'Gauteng'}</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Assessor: {assessorSigObj.name || rep.assessorName} &bull; Manager: {managerSigObj.name || rep.managerName || '---'} &bull; Saved {rep.date}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    background: assessorSigned ? '#EEF7F2' : '#f3f4f6', 
                    color: assessorSigned ? '#1D8A50' : '#4b5563', 
                    fontSize: '0.72rem', 
                    fontWeight: 600, 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}>
                    Assessor {assessorSigned ? '✓' : 'Pending'}
                  </span>
                  <span style={{ 
                    background: managerSigned ? '#EEF7F2' : '#f3f4f6', 
                    color: managerSigned ? '#1D8A50' : '#4b5563', 
                    fontSize: '0.72rem', 
                    fontWeight: 600, 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}>
                    Manager {managerSigned ? '✓' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No TRA checklist records on file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
