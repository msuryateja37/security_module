import React, { useState } from 'react';
import type { TraAudit } from '../types/security';
import { Save, History, Plus } from 'lucide-react';

interface TraChecklistViewProps {
  reports: TraAudit[];
  onSubmitReport: (newReport: TraAudit) => void;
}

const SECTION_A_ITEMS = [
  { id: 'a1', label: 'All personnel vetted' },
  { id: 'a2', label: 'Document security in place (registers and forms)' },
  { id: 'a3', label: 'Classification system' },
  { id: 'a4', label: 'Secure transportation of classified info' },
  { id: 'a5', label: 'Control of destruction of classified info' },
  { id: 'a6', label: 'Positive ID of visitors and contractors' },
  { id: 'a7', label: 'Secure storage of classified info' },
  { id: 'a8', label: 'Categorising of information' },
  { id: 'a9', label: 'Secure transmission of classified info' },
  { id: 'a10', label: 'Register for control of making copies' }
];

const SECTION_B_ITEMS = [
  { id: 'b1', label: 'Security control room in place' },
  { id: 'b2', label: 'Security control room has registers in place' },
  { id: 'b3', label: 'Security control room has sufficient equipment' },
  { id: 'b4', label: 'Security control room has sufficient communication equipment' },
  { id: 'b5', label: 'Site floor plans available in control room' },
  { id: 'b6', label: 'Access control – intruder detection, access control, perimeter protection, lighting' },
  { id: 'b7', label: 'Intruder alarm system in place' },
  { id: 'b8', label: 'Security equipment at all access/egress points' },
  { id: 'b9', label: 'CCTV in place – especially at access/egress point' },
  { id: 'b10', label: 'CCTV cameras positioned correctly' },
  { id: 'b11', label: 'CCTV cameras in working condition' },
  { id: 'b12', label: 'CCTV systems regularly maintained and tested' },
  { id: 'b13', label: 'Security personnel registered with PSIRA' },
  { id: 'b14', label: 'Establishment of security committee' },
  { id: 'b15', label: 'Security assessment by SSA done' },
  { id: 'b16', label: 'Record of previous breaches' },
  { id: 'b17', label: 'Burglar proofing in sensitive areas' },
  { id: 'b18', label: 'External doors and frames in line with specifications' },
  { id: 'b19', label: 'Key registers in place' },
  { id: 'b20', label: 'Duplicate keys stored in safe place and accounted for' },
  { id: 'b21', label: 'Security locks on doors' },
  { id: 'b22', label: 'Security patrols done around perimeter' },
  { id: 'b23', label: 'Vehicle registers in place' },
  { id: 'b24', label: 'Vehicles and trucks entering the premises are not searched' },
  { id: 'b25', label: 'Facility security zoned' },
  { id: 'b26', label: 'Control of prohibited items – register in place' }
];

const SECTION_C_ITEMS = [
  { id: 'c1', label: 'Contingency plan in place' },
  { id: 'c2', label: 'Evacuation plan correctly displayed' },
  { id: 'c3', label: 'Emergency team details displayed' },
  { id: 'c4', label: 'First Aid box available and mounted' },
  { id: 'c5', label: 'Evacuation chair available and mounted' },
  { id: 'c6', label: 'All exit routes unobstructed' },
  { id: 'c7', label: 'Emergency exit design is suitable and functioning' },
  { id: 'c8', label: 'Emergency drill conducted' },
  { id: 'c9', label: 'Generator/UPS in place' },
  { id: 'c10', label: 'Generator service' },
  { id: 'c11', label: 'Generator tested last' },
  { id: 'c12', label: 'Sufficient fire fighting aids' },
  { id: 'c13', label: 'Servicing of fire extinguishers' },
  { id: 'c14', label: 'OHS signage erected' },
  { id: 'c15', label: 'Ablution facilities' },
  { id: 'c16', label: 'Facilities for persons with disabilities' }
];

export const TraChecklistView: React.FC<TraChecklistViewProps> = ({ reports, onSubmitReport }) => {
  const [showHistory, setShowHistory] = useState(false);

  // Header states
  const [officeName, setOfficeName] = useState('');
  const [date, setDate] = useState('');
  const [assessorName, setAssessorName] = useState('Supervisor');
  const [officeLocation, setOfficeLocation] = useState('');
  const [time, setTime] = useState('');
  const [managerName, setManagerName] = useState('');
  const [assessorSignature, setAssessorSignature] = useState('');
  const [managerSignature, setManagerSignature] = useState('');

  // Local checklist states: itemId -> string
  const [checklistValues, setChecklistValues] = useState<{ [itemId: string]: string }>({});

  const handleInputChange = (itemId: string, val: string) => {
    setChecklistValues(prev => ({
      ...prev,
      [itemId]: val
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName || !date || !assessorName) {
      alert('Please fill in required fields (Office Name, Date, and Assessor Name).');
      return;
    }

    const formattedValues: {
      [itemId: string]: {
        status: 'Compliant' | 'Non-Compliant' | 'N/A';
        notes: string;
      }
    } = {};

    [...SECTION_A_ITEMS, ...SECTION_B_ITEMS, ...SECTION_C_ITEMS].forEach(item => {
      const val = checklistValues[item.id] || '';
      let status: 'Compliant' | 'Non-Compliant' | 'N/A' = 'Compliant';
      
      const valLower = val.toLowerCase();
      if (valLower.includes('non') || valLower === 'no' || valLower === 'nc') {
        status = 'Non-Compliant';
      } else if (valLower.includes('na') || valLower === 'n/a') {
        status = 'N/A';
      }

      formattedValues[item.id] = {
        status,
        notes: val
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
    
    // Reset values
    setOfficeName('');
    setDate('');
    setAssessorName('');
    setOfficeLocation('');
    setTime('');
    setManagerName('');
    setAssessorSignature('');
    setManagerSignature('');
    setChecklistValues({});

    alert('Threat and Risk Assessment checklist submitted successfully.');
  };

  // Split section items into two columns
  const getHalfItems = (items: { id: string; label: string }[]) => {
    const half = Math.ceil(items.length / 2);
    return [items.slice(0, half), items.slice(half)];
  };

  return (
    <div>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', color: '#003326', margin: 0 }}>Threat and Risk Assessment (TRA)</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: 0 }}>Filing and compliance log for Threat & Risk Assessments</p>
        </div>
        <div>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowHistory(!showHistory)}
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {showHistory ? <Plus size={16} /> : <History size={16} />}
            {showHistory ? 'New Form' : 'View History'}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Submitted TRA Audit Records
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {reports.map(rep => {
              const values = Object.values(rep.checklistValues);
              const compliant = values.filter(v => v.status === 'Compliant').length;
              const nonCompliant = values.filter(v => v.status === 'Non-Compliant').length;

              return (
                <div 
                  key={rep.id} 
                  className="glass-card" 
                  style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))', background: 'rgba(255,255,255,0.01)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))', fontSize: '1rem' }}>
                      TRA: {rep.officeName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      Date: {rep.date} | Assessed By: {rep.assessorName}
                    </span>
                  </div>

                  <div className="form-grid" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Office Location: </span>
                      <span>{rep.officeLocation || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Compliance Summary: </span>
                      <span style={{ color: 'hsl(var(--color-success))', fontWeight: 600 }}>{compliant} Compliant</span>
                      <span> / </span>
                      <span style={{ color: 'hsl(var(--color-danger))', fontWeight: 600 }}>{nonCompliant} Non-Compliant</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                No TRA audits performed yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#1f2937', fontWeight: 700, borderBottom: '2px solid #eaebeb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              THREAT AND RISK ASSESSMENT (TRA) CHECKLIST
            </h3>

            {/* General parameters matching image9.png */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Office Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={officeName} 
                  onChange={(e) => setOfficeName(e.target.value)} 
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
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
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
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Assessor Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={assessorName} 
                  onChange={(e) => setAssessorName(e.target.value)} 
                  required 
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
                />
              </div>
            </div>

            {/* Signature Box */}
            <div className="signature-box-styled" style={{ marginBottom: '2rem' }}>
              <div className="signature-line-group">
                <input 
                  type="text" 
                  placeholder="Enter" 
                  className="form-input" 
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #4b5563', borderRadius: 0, paddingLeft: 0, paddingRight: 0 }}
                  value={assessorSignature}
                  onChange={(e) => setAssessorSignature(e.target.value)}
                  required
                />
                <span className="signature-line-label" style={{ marginTop: '0.5rem' }}>Assessor Signature</span>
              </div>
              <div className="signature-line-group">
                <input 
                  type="text" 
                  placeholder="Enter" 
                  className="form-input" 
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #4b5563', borderRadius: 0, paddingLeft: 0, paddingRight: 0 }}
                  value={managerSignature}
                  onChange={(e) => setManagerSignature(e.target.value)}
                />
                <span className="signature-line-label" style={{ marginTop: '0.5rem' }}>Manager Signature</span>
              </div>
            </div>

            {/* Section A */}
            <div className="indicator-header">
              <span className="indicator-number-badge">A</span>
              <span className="indicator-title-text" style={{ textTransform: 'uppercase' }}>INFORMATION/PERSONNEL SECURITY</span>
            </div>

            <div className="form-grid" style={{ marginBottom: '2rem', rowGap: '1.25rem', columnGap: '2rem' }}>
              <div>
                {getHalfItems(SECTION_A_ITEMS)[0].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div>
                {getHalfItems(SECTION_A_ITEMS)[1].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Section B */}
            <div className="indicator-header">
              <span className="indicator-number-badge">B</span>
              <span className="indicator-title-text" style={{ textTransform: 'uppercase' }}>PHYSICAL SECURITY</span>
            </div>

            <div className="form-grid" style={{ marginBottom: '2rem', rowGap: '1.25rem', columnGap: '2rem' }}>
              <div>
                {getHalfItems(SECTION_B_ITEMS)[0].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div>
                {getHalfItems(SECTION_B_ITEMS)[1].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Section C */}
            <div className="indicator-header">
              <span className="indicator-number-badge">C</span>
              <span className="indicator-title-text" style={{ textTransform: 'uppercase' }}>OCCUPATIONAL HEALTH AND SAFETY</span>
            </div>

            <div className="form-grid" style={{ marginBottom: '2rem', rowGap: '1.25rem', columnGap: '2rem' }}>
              <div>
                {getHalfItems(SECTION_C_ITEMS)[0].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div>
                {getHalfItems(SECTION_C_ITEMS)[1].map(item => (
                  <div key={item.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.label}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter" 
                      value={checklistValues[item.id] || ''}
                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '2px solid #eaebeb', paddingTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 2.5rem', background: '#31b399', fontWeight: 700, borderRadius: '4px' }}>
                <Save size={16} /> Submit
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
