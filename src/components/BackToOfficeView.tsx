import React, { useState } from 'react';
import type { BackToOfficeReport } from '../types/security';
import { FileText, Save, History, Plus } from 'lucide-react';
import { useModal } from './NotificationModal';

interface BackToOfficeViewProps {
  reports: BackToOfficeReport[];
  onSubmitReport: (newReport: BackToOfficeReport) => void;
}

export const BackToOfficeView: React.FC<BackToOfficeViewProps> = ({ reports, onSubmitReport }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { showAlert } = useModal();
  
  // Form states
  const [officialName, setOfficialName] = useState('Supervisor');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [times, setTimes] = useState('');
  const [staffStakeholders, setStaffStakeholders] = useState('');
  const [eventName, setEventName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [mattersNoting, setMattersNoting] = useState('');
  const [designation, setDesignation] = useState('Security Specialist');
  const [signature, setSignature] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialName || !date || !eventName) {
      showAlert('Please fill in required fields (Name of Official, Date, and Event Name).', 'Validation Error', 'warning');
      return;
    }

    const report: BackToOfficeReport = {
      id: `bto-${Date.now()}`,
      officialName,
      date,
      venue,
      times,
      staffStakeholders,
      eventName,
      purpose,
      expectedOutput,
      discussionPoints,
      mattersNoting,
      designation,
      signature,
      dateCreated: new Date().toISOString().split('T')[0]
    };

    onSubmitReport(report);
    
    // Reset form
    setOfficialName('');
    setDate('');
    setVenue('');
    setTimes('');
    setStaffStakeholders('');
    setEventName('');
    setPurpose('');
    setExpectedOutput('');
    setDiscussionPoints('');
    setMattersNoting('');
    setDesignation('');
    setSignature('');

    showAlert('Back to Office Report successfully logged.', 'Report Submitted', 'success');
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Back to Office Report</h1>
          <p className="page-subtitle">File outcomes and notes of external meetings, assessments, and taskings</p>
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
            Submitted Back to Office Reports
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map(rep => (
              <div 
                key={rep.id} 
                className="glass-card" 
                style={{ padding: '1.25rem', border: '1px solid hsl(var(--border-color))', background: 'rgba(255,255,255,0.01)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))', fontSize: '1rem' }}>
                    {rep.eventName}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    Filing Date: {rep.dateCreated} | Meeting Date: {rep.date}
                  </span>
                </div>

                <div className="form-grid" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block' }}>Official Name / Designation</span>
                    <span>{rep.officialName} ({rep.designation || 'N/A'})</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block' }}>Venue / Location / Times</span>
                    <span>{rep.venue || 'N/A'} ({rep.times || 'N/A'})</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {rep.purpose && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Purpose:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.purpose}</p>
                    </div>
                  )}
                  {rep.expectedOutput && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Expected Output:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.expectedOutput}</p>
                    </div>
                  )}
                  {rep.discussionPoints && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Key Discussions / Decisions Reached:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.discussionPoints}</p>
                    </div>
                  )}
                  {rep.mattersNoting && (
                    <div>
                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500, display: 'block' }}>Key Matters for Noting:</span>
                      <p style={{ color: 'hsl(var(--text-primary))' }}>{rep.mattersNoting}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                No reports submitted yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid hsl(var(--border-color))', paddingBottom: '0.5rem', fontSize: '1.25rem', color: '#1f2937' }}>
              <FileText size={22} color="hsl(var(--color-primary))" />
              Back to Office Report
            </h3>

            {/* Row 1: Name of Official & Event Name */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Name of Official</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter name"
                  value={officialName} 
                  onChange={(e) => setOfficialName(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Meeting / Tasking / Event Name / Assessment</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter name"
                  value={eventName} 
                  onChange={(e) => setEventName(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {/* Row 2: Venue/Location & Date */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Venue / Location</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter venue / location"
                  value={venue} 
                  onChange={(e) => setVenue(e.target.value)} 
                />
              </div>
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
            </div>

            {/* Row 3: Times (50%) */}
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Times</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter times"
                  value={times} 
                  onChange={(e) => setTimes(e.target.value)} 
                />
              </div>
              <div className="form-group"></div>
            </div>

            {/* Row 4: DLRRD Staff and Stakeholders */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>DLRRD Staff and Stakeholders</label>
              <textarea 
                rows={3} 
                className="form-input" 
                placeholder="Enter"
                value={staffStakeholders} 
                onChange={(e) => setStaffStakeholders(e.target.value)} 
              />
            </div>

            {/* Row 5: Purpose of the Meeting */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Purpose of the Meeting / Intervention / Event</label>
              <textarea 
                rows={3} 
                className="form-input" 
                placeholder="Enter"
                value={purpose} 
                onChange={(e) => setPurpose(e.target.value)} 
              />
            </div>

            {/* Row 6: Expected Output */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Expected Output</label>
              <textarea 
                rows={3} 
                className="form-input" 
                placeholder="Enter"
                value={expectedOutput} 
                onChange={(e) => setExpectedOutput(e.target.value)} 
              />
            </div>

            {/* Row 7: Key Discussion Points */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Key Discussion Point / Activities / Decisions Reached</label>
              <textarea 
                rows={4} 
                className="form-input" 
                placeholder="Enter"
                value={discussionPoints} 
                onChange={(e) => setDiscussionPoints(e.target.value)} 
              />
            </div>

            {/* Row 8: Key Matters for Noting */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Key Matters for Noting</label>
              <textarea 
                rows={3} 
                className="form-input" 
                placeholder="Enter"
                value={mattersNoting} 
                onChange={(e) => setMattersNoting(e.target.value)} 
              />
            </div>

            {/* Row 9: Signature & Date Box (Underlines styled) */}
            <div className="signature-box-styled">
              <div className="signature-line-group">
                <input 
                  type="text" 
                  placeholder="Type signature code (e.g. /S/ J. Smith)" 
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

            {/* Row 10: Designation */}
            <div className="form-grid" style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Designation</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter designation"
                  value={designation} 
                  onChange={(e) => setDesignation(e.target.value)} 
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
