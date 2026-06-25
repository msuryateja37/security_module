import React, { useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { PROVINCES } from '../data/mockData';
import { Search, Eye, X, Save } from 'lucide-react';

interface RegisterViewProps {
  incidents: SecurityIncident[];
  onUpdateIncident: (updatedIncident: SecurityIncident) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ incidents, onUpdateIncident }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterClassification, setFilterClassification] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Selected incident for detail view drawer
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  
  // Local edit states inside drawer
  const [editStatus, setEditStatus] = useState<SecurityIncident['status']>('Open');
  const [editClassification, setEditClassification] = useState<SecurityIncident['classification']>('Unclassified');
  const [editResponsible, setEditResponsible] = useState('');
  const [editOutcome, setEditOutcome] = useState('');
  const [editSapsNumber, setEditSapsNumber] = useState('');
  const [editPoliceStation, setEditPoliceStation] = useState('');
  const [editArrests, setEditArrests] = useState(0);
  const [editReportedToSaps, setEditReportedToSaps] = useState<SecurityIncident['reportedToSapsSsa']>('No');

  const isClosed = selectedIncident?.status === 'Closed';

  // Open drawer and set state
  const handleOpenDrawer = (inc: SecurityIncident) => {
    setSelectedIncident(inc);
    setEditStatus(inc.status);
    setEditClassification(inc.classification);
    setEditResponsible(inc.responsiblePerson || '');
    setEditOutcome(inc.outcomeOfInvestigation);
    setEditSapsNumber(inc.sapsCaseNumber || '');
    setEditPoliceStation(inc.policeStation || '');
    setEditArrests(inc.arrests || 0);
    setEditReportedToSaps(inc.reportedToSapsSsa);
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setSelectedIncident(null);
  };

  // Save changes
  const handleSaveChanges = () => {
    if (!selectedIncident) return;
    
    const updated: SecurityIncident = {
      ...selectedIncident,
      status: editStatus,
      classification: editClassification,
      responsiblePerson: editResponsible,
      outcomeOfInvestigation: editOutcome,
      sapsCaseNumber: editSapsNumber,
      policeStation: editPoliceStation,
      arrests: editArrests,
      reportedToSapsSsa: editReportedToSaps,
    };
    
    onUpdateIncident(updated);
    setSelectedIncident(updated); // Update drawer view
    
    // Add success toast alert simulation in UI
    alert(`Case ${updated.refNo} has been successfully updated.`);
  };

  // Filter incidents
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = 
      inc.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.natureOfLoss.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.sapsCaseNumber && inc.sapsCaseNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      inc.reportedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.place.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesProvince = !filterProvince || inc.province === filterProvince;
    const matchesClassification = !filterClassification || inc.classification === filterClassification;
    const matchesStatus = !filterStatus || inc.status === filterStatus;
    
    return matchesSearch && matchesProvince && matchesClassification && matchesStatus;
  });

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Security Incidents Register</h1>
          <p className="page-subtitle">Departmental Incident Logs & Investigation Case Files</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ flexGrow: 1, minWidth: '240px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}>
              <Search size={18} />
            </span>
            <input 
              type="text" 
              placeholder="Search by Ref No, description, CAS number, officer..." 
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Province Filter */}
          <div style={{ minWidth: '150px' }}>
            <select 
              className="form-input" 
              value={filterProvince} 
              onChange={(e) => setFilterProvince(e.target.value)}
            >
              <option value="">All Provinces</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Classification Filter */}
          <div style={{ minWidth: '150px' }}>
            <select 
              className="form-input" 
              value={filterClassification} 
              onChange={(e) => setFilterClassification(e.target.value)}
            >
              <option value="">All Classifications</option>
              <option value="Unclassified">Unclassified</option>
              <option value="Restricted">Restricted</option>
              <option value="Confidential">Confidential</option>
              <option value="Secret">Secret</option>
              <option value="Top Secret">Top Secret</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '150px' }}>
            <select 
              className="form-input" 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="SAPS Case">SAPS Case</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Register Grid Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Ref No.</th>
              <th>Incident Summary</th>
              <th>Place</th>
              <th>Province</th>
              <th>Date of incident</th>
              <th>Value of Loss</th>
              <th>Classification</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map(inc => {
              let badgeClass = 'badge primary';
              if (inc.status === 'Closed') badgeClass = 'badge success';
              if (inc.status === 'SAPS Case') badgeClass = 'badge danger';
              if (inc.status === 'Under Investigation') badgeClass = 'badge warning';

              let classificationBadge = 'badge muted';
              if (inc.classification === 'Secret') classificationBadge = 'badge warning';
              if (inc.classification === 'Top Secret') classificationBadge = 'badge danger';
              if (inc.classification === 'Restricted') classificationBadge = 'badge primary';

              return (
                <tr key={inc.id}>
                  <td style={{ fontWeight: 600, color: 'hsl(var(--color-primary))' }}>{inc.refNo}</td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.natureOfLoss}
                  </td>
                  <td>{inc.place}</td>
                  <td>{inc.province}</td>
                  <td>{new Date(inc.dateTime).toLocaleDateString()} {new Date(inc.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>R {inc.lossValue.toLocaleString()}</td>
                  <td>
                    <span className={classificationBadge}>{inc.classification}</span>
                  </td>
                  <td>
                    <span className={badgeClass}>{inc.status}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleOpenDrawer(inc)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', gap: '0.25rem' }}
                    >
                      <Eye size={14} /> Review
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredIncidents.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                  No security cases found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Case Details Drawer (Slide-Over) */}
      {selectedIncident && (
        <div className="drawer-backdrop" onClick={handleCloseDrawer}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--color-primary))' }}>{selectedIncident.refNo}</h3>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  Register No: {selectedIncident.registerNumber} | Submitted: {selectedIncident.dateCreated}
                </span>
              </div>
              <button 
                onClick={handleCloseDrawer} 
                style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-content">
              {/* Incident Header Stats */}
              <div className="glass-card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>DEPARTMENT / INSTITUTION</div>
                  <div style={{ fontWeight: 500 }}>{selectedIncident.department}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>REPORTED BY</div>
                  <div style={{ fontWeight: 500 }}>{selectedIncident.reportedBy}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>DATE & TIME OF INCIDENT</div>
                  <div style={{ fontWeight: 500 }}>{new Date(selectedIncident.dateTime).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>PLACE / PROVINCE</div>
                  <div style={{ fontWeight: 500 }}>{selectedIncident.place} ({selectedIncident.province})</div>
                </div>
              </div>

              {/* Case Updates Inputs */}
              <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', fontSize: '0.95rem' }}>
                  Case Management & Classification
                </h4>
                
                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Investigation Status</label>
                    <select 
                      className="form-input" 
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as SecurityIncident['status'])}
                      disabled={isClosed}
                    >
                      <option value="Open">Open</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="SAPS Case">SAPS Case</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Security Classification</label>
                    <select 
                      className="form-input" 
                      value={editClassification}
                      onChange={(e) => setEditClassification(e.target.value as SecurityIncident['classification'])}
                      disabled={isClosed}
                    >
                      <option value="Unclassified">Unclassified</option>
                      <option value="Restricted">Restricted</option>
                      <option value="Confidential">Confidential</option>
                      <option value="Secret">Secret</option>
                      <option value="Top Secret">Top Secret</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Responsible Security Officer</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Security Manager Mandla Mnguni"
                    value={editResponsible}
                    onChange={(e) => setEditResponsible(e.target.value)}
                    disabled={isClosed}
                  />
                </div>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Reported to SAPS / SSA?</label>
                    <select 
                      className="form-input" 
                      value={editReportedToSaps}
                      onChange={(e) => setEditReportedToSaps(e.target.value as SecurityIncident['reportedToSapsSsa'])}
                      disabled={isClosed}
                    >
                      <option value="No">No</option>
                      <option value="Pending">Pending</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  {editReportedToSaps === 'Yes' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">SAPS CAS Case Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. CAS 124/05/2026"
                        value={editSapsNumber}
                        onChange={(e) => setEditSapsNumber(e.target.value)}
                        disabled={isClosed}
                      />
                    </div>
                  )}
                </div>

                {editReportedToSaps === 'Yes' && (
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Police Station where reported</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Pretoria Central"
                        value={editPoliceStation}
                        onChange={(e) => setEditPoliceStation(e.target.value)}
                        disabled={isClosed}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Number of arrests made (if any)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={editArrests}
                        onChange={(e) => setEditArrests(parseInt(e.target.value) || 0)}
                        disabled={isClosed}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Outcome & Investigation Findings</label>
                  <textarea 
                    rows={4} 
                    className="form-input" 
                    placeholder="Enter detailed outcome of investigation..." 
                    style={{ resize: 'vertical' }}
                    value={editOutcome}
                    onChange={(e) => setEditOutcome(e.target.value)}
                    disabled={isClosed}
                  />
                </div>
              </div>

              {/* Full Details Display */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', fontSize: '0.95rem' }}>
                  Full Incident Notification Record
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Nature & Type of Incident</span>
                    <span>{selectedIncident.incidentType.join(', ')}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Detailed Nature of Loss / Damage</span>
                    <span>{selectedIncident.natureOfLoss}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Estimated Loss Value (Rands)</span>
                    <span style={{ color: 'hsl(var(--color-danger))', fontWeight: 600 }}>R {selectedIncident.lossValue.toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Injuries or Fatalities</span>
                    <span>{selectedIncident.injuriesFatalities}</span>
                  </div>

                  <h5 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem', marginTop: '0.5rem' }}>NOC Incident Details</h5>
                  
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>What happened?</span>
                    <span>{selectedIncident.whatHappened || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Where did it happen?</span>
                    <span>{selectedIncident.whereHappened || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>How did it happen?</span>
                    <span>{selectedIncident.howHappened || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Who was responsible?</span>
                    <span>{selectedIncident.whoResponsible || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Weapons & equipment used?</span>
                    <span>{selectedIncident.weaponsUsed || 'None'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Lessons learned?</span>
                    <span>{selectedIncident.lessonsLearned || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))', display: 'block', fontWeight: 600 }}>Recommendations?</span>
                    <span>{selectedIncident.recommendations || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              {!isClosed && (
                <button className="btn btn-primary" style={{ flexGrow: 1 }} onClick={handleSaveChanges}>
                  <Save size={16} /> Save Changes
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                style={isClosed ? { flexGrow: 1 } : {}} 
                onClick={handleCloseDrawer}
              >
                {isClosed ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
