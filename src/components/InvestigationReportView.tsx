import React, { useState } from 'react';
import type { InvestigationReport } from '../types/security';
import { FileSearch, Save, History, Plus } from 'lucide-react';
import { useModal } from './NotificationModal';

interface InvestigationReportViewProps {
  reports: InvestigationReport[];
  onSubmitReport: (newReport: InvestigationReport) => void;
}

export const InvestigationReportView: React.FC<InvestigationReportViewProps> = ({ reports, onSubmitReport }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { showAlert } = useModal();
  
  // Form states
  const [subject, setSubject] = useState('');
  const [purpose, setPurpose] = useState('');
  const [scope, setScope] = useState('');
  const [background, setBackground] = useState('');
  const [factualInfo, setFactualInfo] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [officerName, setOfficerName] = useState('Supervisor');
  const [rank, setRank] = useState('Senior Security Supervisor');
  const [office, setOffice] = useState('');
  const [date, setDate] = useState('');
  const [signature, setSignature] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !date || !officerName) {
      showAlert('Please fill in required fields (Subject, Date, and Officer Name).', 'Validation Error', 'warning');
      return;
    }

    const report: InvestigationReport = {
      id: `inv-${Date.now()}`,
      subject,
      purpose,
      scope,
      background,
      factualInfo,
      findings,
      recommendations,
      officerName,
      rank,
      office,
      date,
      signature,
      dateCreated: new Date().toISOString().split('T')[0]
    };

    onSubmitReport(report);
    
    // Reset form
    setSubject('');
    setPurpose('');
    setScope('');
    setBackground('');
    setFactualInfo('');
    setFindings('');
    setRecommendations('');
    setOfficerName('');
    setRank('');
    setOffice('');
    setDate('');
    setSignature('');

    showAlert('Investigation Report successfully compiled.', 'Report Compiled', 'success');
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Investigation Report</h1>
          <p className="page-subtitle">Compile detailed findings, factual evidence, and security recommendations</p>
        </div>
        <div>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowHistory(!showHistory)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {showHistory ? <Plus size={16} /> : <History size={16} />}
            {showHistory ? 'New Report Form' : 'View Filing History'}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={20} color="hsl(var(--color-primary))" />
            Submitted Investigation Reports
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {reports.map(rep => (
              <div 
                key={rep.id} 
                className="glass-card" 
                style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))', background: 'rgba(255,255,255,0.01)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))', fontSize: '1rem' }}>
                    {rep.subject}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    Report Date: {rep.date} | Compiled: {rep.dateCreated}
                  </span>
                </div>

                <div className="form-grid" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block' }}>Investigating Officer / Rank</span>
                    <span>{rep.officerName} ({rep.rank || 'N/A'})</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block' }}>Office Location</span>
                    <span>{rep.office || 'N/A'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {rep.purpose && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Purpose of Investigation:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.purpose}</p>
                    </div>
                  )}
                  {rep.scope && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Scope of Investigation:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.scope}</p>
                    </div>
                  )}
                  {rep.background && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Background Information:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.background}</p>
                    </div>
                  )}
                  {rep.factualInfo && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Factual Collected Information:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.factualInfo}</p>
                    </div>
                  )}
                  {rep.findings && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Findings:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.findings}</p>
                    </div>
                  )}
                  {rep.recommendations && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Recommendations:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.recommendations}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                No investigation reports submitted yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid hsl(var(--border-color))', paddingBottom: '0.5rem', fontSize: '1.25rem', color: '#1f2937' }}>
              <FileSearch size={22} color="hsl(var(--color-primary))" />
              Investigation Report
            </h3>

            {/* Row 1: Subject Heading & Purpose */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Subject Heading</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter subject"
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Purpose</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter purpose"
                  value={purpose} 
                  onChange={(e) => setPurpose(e.target.value)} 
                />
              </div>
            </div>

            {/* Row 2: Background Information & Scope of Investigaton */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Background Information</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter information"
                  value={background} 
                  onChange={(e) => setBackground(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Scope of Investigaton</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter scope"
                  value={scope} 
                  onChange={(e) => setScope(e.target.value)} 
                />
              </div>
            </div>

            {/* Row 3: Factual Collected Information & Findings */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Factual Collected Information</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter info"
                  value={factualInfo} 
                  onChange={(e) => setFactualInfo(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Findings</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter findings"
                  value={findings} 
                  onChange={(e) => setFindings(e.target.value)} 
                />
              </div>
            </div>

            {/* Row 4: Recommendations (100% textarea) */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Recommendations</label>
              <textarea 
                rows={4} 
                className="form-input" 
                placeholder="Enter"
                value={recommendations} 
                onChange={(e) => setRecommendations(e.target.value)} 
              />
            </div>

            {/* Row 5: Signature & Date styled container */}
            <div className="signature-box-styled">
              <div className="signature-line-group">
                <input 
                  type="text" 
                  placeholder="Type signature code" 
                  className="form-input" 
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #4b5563', borderRadius: 0, paddingLeft: 0, paddingRight: 0 }}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  required
                />
                <span className="signature-line-label" style={{ marginTop: '0.5rem' }}>Signature</span>
              </div>
              <div className="signature-line-group">
                <input 
                  type="text" 
                  readOnly 
                  className="form-input" 
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #4b5563', borderRadius: 0, paddingLeft: 0, paddingRight: 0 }}
                  value={date}
                />
                <span className="signature-line-label" style={{ marginTop: '0.5rem' }}>Date</span>
              </div>
            </div>

            {/* Row 6: Name and Surname & Rank */}
            <div className="form-grid" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Name and Surname</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={officerName} 
                  onChange={(e) => setOfficerName(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Rank</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={rank} 
                  onChange={(e) => setRank(e.target.value)} 
                />
              </div>
            </div>

            {/* Row 7: Office (50%) & Submit Button */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Office</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={office} 
                  onChange={(e) => setOffice(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 2rem', background: '#31b399', borderRadius: '4px', fontWeight: 700 }}>
                  <Save size={16} /> Submit
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
