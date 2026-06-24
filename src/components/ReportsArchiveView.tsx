import React, { useState } from 'react';
import type { BackToOfficeReport, InvestigationReport, QuarterlyReport, TraAudit } from '../types/security';
import { Archive, Printer, Eye, X, Search } from 'lucide-react';

interface ReportsArchiveViewProps {
  btoReports: BackToOfficeReport[];
  invReports: InvestigationReport[];
  qtrReports: QuarterlyReport[];
  traAudits: TraAudit[];
}

type DocType = 'bto' | 'inv' | 'qtr' | 'tra';

interface DocItem {
  id: string;
  type: DocType;
  title: string;
  date: string;
  creator: string;
  data: any;
}

export const ReportsArchiveView: React.FC<ReportsArchiveViewProps> = ({ btoReports, invReports, qtrReports, traAudits }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  const allDocs: DocItem[] = [
    ...btoReports.map(r => ({
      id: r.id,
      type: 'bto' as DocType,
      title: `Back to Office: ${r.eventName}`,
      date: r.dateCreated,
      creator: r.officialName,
      data: r
    })),
    ...invReports.map(r => ({
      id: r.id,
      type: 'inv' as DocType,
      title: `Investigation Report: ${r.subject}`,
      date: r.dateCreated,
      creator: r.officerName,
      data: r
    })),
    ...qtrReports.map(r => ({
      id: r.id,
      type: 'qtr' as DocType,
      title: `Quarterly Report: Q${r.quarterNumber} (${r.year}) - ${r.province}`,
      date: r.dateCreated,
      creator: r.program,
      data: r
    })),
    ...traAudits.map(r => ({
      id: r.id,
      type: 'tra' as DocType,
      title: `TRA Checklist Audit: ${r.officeName}`,
      date: r.dateCreated,
      creator: r.assessorName,
      data: r
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredDocs = allDocs.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.creator.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocTypeLabel = (type: DocType) => {
    switch (type) {
      case 'bto': return 'Back to Office';
      case 'inv': return 'Investigation';
      case 'qtr': return 'Quarterly Report';
      default: return 'TRA Audit';
    }
  };

  const getDocTypeClass = (type: DocType) => {
    switch (type) {
      case 'bto': return 'success';
      case 'inv': return 'danger';
      case 'qtr': return 'primary';
      default: return 'warning';
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Filing System Archive</h1>
          <p className="page-subtitle">Search, view, and print submitted security reports, assessments, and checklists</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search documents by title, author, or report type..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Document Title</th>
                <th>Report Type</th>
                <th>Creator / Filer</th>
                <th>Date Filed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                      {doc.title}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getDocTypeClass(doc.type)}`}>
                      {getDocTypeLabel(doc.type)}
                    </span>
                  </td>
                  <td>{doc.creator}</td>
                  <td>{doc.date}</td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedDoc(doc)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Eye size={12} /> Open Document
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                    <Archive size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p>No archived reports found matching the search criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-card" style={{ background: 'white', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: 'var(--radius-md)', position: 'relative' }}>
            
            <button 
              onClick={() => setSelectedDoc(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
            >
              <X size={24} />
            </button>

            <div style={{ borderBottom: '2px solid hsl(var(--border-color))', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span className={`badge ${getDocTypeClass(selectedDoc.type)}`} style={{ marginBottom: '0.5rem' }}>
                {getDocTypeLabel(selectedDoc.type)}
              </span>
              <h2>{selectedDoc.title}</h2>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                Filed by {selectedDoc.creator} on {selectedDoc.date}
              </span>
            </div>

            {selectedDoc.type === 'bto' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Venue / Location:</strong> {selectedDoc.data.venue}</div>
                <div><strong>Times / Duration:</strong> {selectedDoc.data.times}</div>
                <div><strong>Staff & Stakeholders:</strong> {selectedDoc.data.staffStakeholders}</div>
                <div><strong>Purpose:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.purpose}</p></div>
                <div><strong>Expected Output:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.expectedOutput}</p></div>
                <div><strong>Key Discussions & Decisions Reached:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.discussionPoints}</p></div>
                <div><strong>Key Matters for Noting:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.mattersNoting}</p></div>
                <div><strong>Official Designation:</strong> {selectedDoc.data.designation}</div>
                <div><strong>Official Signature:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedDoc.data.signature}</span></div>
              </div>
            )}

            {selectedDoc.type === 'inv' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Purpose of Investigation:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.purpose}</p></div>
                <div><strong>Scope of Investigation:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.scope}</p></div>
                <div><strong>Background Information:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.background}</p></div>
                <div><strong>Factual Collected Information:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.factualInfo}</p></div>
                <div><strong>Findings:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.findings}</p></div>
                <div><strong>Recommendations:</strong> <p style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginTop: '0.25rem' }}>{selectedDoc.data.recommendations}</p></div>
                <div><strong>Officer Designation/Office:</strong> {selectedDoc.data.rank} ({selectedDoc.data.office})</div>
                <div><strong>Signature:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedDoc.data.signature}</span></div>
              </div>
            )}

            {selectedDoc.type === 'qtr' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Quarter:</strong> Q{selectedDoc.data.quarterNumber} | <strong>Year:</strong> {selectedDoc.data.year}</div>
                <div><strong>Program:</strong> {selectedDoc.data.program} | <strong>Branch:</strong> {selectedDoc.data.branch}</div>
                <div>
                  <strong>Indicator Breakdown:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {Object.entries(selectedDoc.data.indicatorValues).map(([name, item]: any) => (
                      <div key={name} style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 600 }}>{name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                          Target (Quarter): {item.quarterTarget} | Actual Performance: {item.actualQuarterPerformance}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedDoc.type === 'tra' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Office Name:</strong> {selectedDoc.data.officeName} | <strong>Location:</strong> {selectedDoc.data.officeLocation}</div>
                <div><strong>Assessor:</strong> {selectedDoc.data.assessorName} | <strong>Date/Time:</strong> {selectedDoc.data.date} ({selectedDoc.data.time})</div>
                <div><strong>Manager:</strong> {selectedDoc.data.managerName}</div>
                <div>
                  <strong>Checklist Results Summary:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {Object.entries(selectedDoc.data.checklistValues).map(([key, value]: any) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.85rem' }}>{key}</span>
                        <span className="badge" style={{ background: value.status === 'Compliant' ? '#dcfce7' : value.status === 'Non-Compliant' ? '#fee2e2' : '#f3f4f6', color: value.status === 'Compliant' ? '#166534' : value.status === 'Non-Compliant' ? '#991b1b' : '#374151' }}>
                          {value.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={14} /> Print Document
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedDoc(null)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
