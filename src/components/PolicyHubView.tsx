import React, { useState } from 'react';
import type { ChecklistItem } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { getPermissionsForRole } from '../security/roleAccess';
import { policySections } from '../data/mockData';
import { BookOpen, ClipboardList, Search, CheckSquare, Square, Save, RotateCcw, FileText, Download, UploadCloud } from 'lucide-react';
import { useModal } from './NotificationModal';

interface PolicyHubViewProps {
  checklists: ChecklistItem[];
  onUpdateChecklist: (updatedChecklist: ChecklistItem[]) => void;
  currentUser?: UserProfile;
}

/** A published policy document as returned by /api/policy-documents (CI-0012). */
interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  revisionDate: string;
  summary: string;
  fileName: string;
  fileSize: number;
  uploadedByName: string;
  isCurrent: boolean;
  dateCreated: string;
}

const POLICY_CATEGORIES = [
  'General',
  'Physical Security',
  'Information Security',
  'Personnel Security',
  'Incident Management',
  'Threat and Risk Assessment'
];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const fmtDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const PolicyHubView: React.FC<PolicyHubViewProps> = ({ checklists, onUpdateChecklist, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'explorer' | 'checklist'>('documents');
  const [policySearch, setPolicySearch] = useState('');
  const [localChecklists, setLocalChecklists] = useState<ChecklistItem[]>([...checklists]);
  const { showAlert, showConfirm } = useModal();

  // ---- Policy document repository (CI-0012) ----
  const canPublish = currentUser ? getPermissionsForRole(currentUser.role).includes('admin:manage_roles') : false;
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docSearch, setDocSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    category: POLICY_CATEGORIES[0],
    version: '1.0',
    effectiveDate: '',
    revisionDate: '',
    summary: ''
  });
  const [newDocFile, setNewDocFile] = useState<File | null>(null);

  const authHeaders = currentUser
    ? { 'x-username': currentUser.username, 'x-user-role': currentUser.role }
    : undefined;

  const loadDocuments = React.useCallback(() => {
    if (!currentUser) return;
    setLoadingDocs(true);
    fetch('/api/policy-documents', { headers: { 'x-username': currentUser.username, 'x-user-role': currentUser.role } })
      .then(res => res.json())
      .then(json => setDocuments(json.success ? json.data || [] : []))
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, [currentUser]);

  React.useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleDownloadDocument = async (doc: PolicyDocument) => {
    if (!authHeaders) return;
    try {
      const res = await fetch(`/api/policy-documents/${doc.id}/download`, { headers: authHeaders });
      if (!res.ok) {
        showAlert('The policy document could not be downloaded.', 'Download Failed', 'warning');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showAlert('The policy document could not be downloaded.', 'Download Failed', 'warning');
    }
  };

  const handlePublishDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authHeaders || publishing) return;
    if (!newDoc.title.trim() || !newDocFile) {
      showAlert('Provide a policy title and select the document file.', 'Validation Error', 'warning');
      return;
    }
    setPublishing(true);
    try {
      const dataBase64 = await readFileAsDataUrl(newDocFile);
      const res = await fetch('/api/policy-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...newDoc,
          fileName: newDocFile.name,
          mimeType: newDocFile.type,
          dataBase64
        })
      });
      const json = await res.json();
      if (!json.success) {
        showAlert(json.error || json.message || 'The policy document could not be published.', 'Upload Failed', 'warning');
        return;
      }
      showAlert(`"${newDoc.title}" v${newDoc.version} is now the current version.`, 'Policy Published', 'success');
      setShowUpload(false);
      setNewDoc({ title: '', category: POLICY_CATEGORIES[0], version: '1.0', effectiveDate: '', revisionDate: '', summary: '' });
      setNewDocFile(null);
      loadDocuments();
    } catch {
      showAlert('The policy document could not be published.', 'Upload Failed', 'warning');
    } finally {
      setPublishing(false);
    }
  };

  const filteredDocuments = documents.filter(d => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.summary || '').toLowerCase().includes(q)
    );
  });

  // Handle ticking checklist item
  const handleToggleChecklist = (id: string) => {
    setLocalChecklists(prev => 
      prev.map(item => {
        if (item.id === id) {
          return { ...item, completed: !item.completed };
        }
        return item;
      })
    );
  };

  // Handle checklist notes change
  const handleNotesChange = (id: string, notes: string) => {
    setLocalChecklists(prev => 
      prev.map(item => {
        if (item.id === id) {
          return { ...item, notes };
        }
        return item;
      })
    );
  };

  // Save checklist state
  const handleSaveChecklist = () => {
    onUpdateChecklist(localChecklists);
    showAlert('Security compliance checklist states successfully saved.', 'Checklist Saved', 'success');
  };

  // Reset checklist state
  const handleResetChecklist = () => {
    showConfirm({
      title: 'Reset Compliance Checklist',
      message: 'Are you sure you want to reset all compliance checklist items to incomplete?',
      confirmText: 'Yes, Reset All',
      type: 'danger',
      onConfirm: () => {
        const reset = localChecklists.map(item => ({ ...item, completed: false, notes: '' }));
        setLocalChecklists(reset);
        onUpdateChecklist(reset);
        showAlert('Compliance checklist items have been reset.', 'Checklist Reset', 'info');
      }
    });
  };

  // Filter policies based on search query
  const filteredPolicies = policySections.filter(sec => 
    sec.title.toLowerCase().includes(policySearch.toLowerCase()) ||
    sec.content.toLowerCase().includes(policySearch.toLowerCase()) ||
    sec.highlights.some(h => h.toLowerCase().includes(policySearch.toLowerCase()))
  );

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Policy & Compliance Hub</h1>
          <p className="page-subtitle">Departmental Security Policy Explorer & Regulatory Verification Checklists</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-container">
        <button
          className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} /> Policy Documents
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} /> Policy Guide Explorer
          </span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={16} /> Audit Compliance Checklists
          </span>
        </button>
      </div>

      {/* Policy document repository — the approved policies investigators reference (CI-0012) */}
      {activeTab === 'documents' && (
        <div>
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexGrow: 1, minWidth: '260px' }}>
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}>
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Search approved policies by title, category or summary..."
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>
            {canPublish && (
              <button className="btn btn-primary" onClick={() => setShowUpload(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UploadCloud size={15} /> {showUpload ? 'Cancel' : 'Publish Policy'}
              </button>
            )}
          </div>

          {canPublish && showUpload && (
            <form className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} onSubmit={handlePublishDocument}>
              <h3 style={{ marginTop: 0 }}>Publish a policy document</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                Publishing a document under an existing title supersedes the earlier version — the
                previous file is retained for historic reference.
              </p>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Policy Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newDoc.title}
                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                    placeholder="e.g. DLRRD Security Policy"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}>
                    {POLICY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Version Number</label>
                  <input type="text" className="form-input" value={newDoc.version} onChange={(e) => setNewDoc({ ...newDoc, version: e.target.value })} placeholder="e.g. 2.1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Effective Date</label>
                  <input type="date" className="form-input" value={newDoc.effectiveDate} onChange={(e) => setNewDoc({ ...newDoc, effectiveDate: e.target.value })} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Next Revision Date</label>
                  <input type="date" className="form-input" value={newDoc.revisionDate} onChange={(e) => setNewDoc({ ...newDoc, revisionDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Document File</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
                    onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Summary</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={newDoc.summary}
                  onChange={(e) => setNewDoc({ ...newDoc, summary: e.target.value })}
                  placeholder="What this policy covers"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={publishing}>
                <Save size={15} /> {publishing ? 'Publishing…' : 'Publish Policy'}
              </button>
            </form>
          )}

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div className="table-container">
              <table className="custom-table compact">
                <thead>
                  <tr>
                    <th>Policy Title</th>
                    <th>Category</th>
                    <th>Version</th>
                    <th>Effective Date</th>
                    <th>Revision Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Document</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{doc.title}</div>
                        {doc.summary && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{doc.summary}</div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {doc.fileName} · {fmtSize(doc.fileSize)} · published by {doc.uploadedByName}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{doc.category}</td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>v{doc.version}</td>
                      <td style={{ fontSize: '0.8rem' }}>{fmtDate(doc.effectiveDate)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{fmtDate(doc.revisionDate)}</td>
                      <td>
                        <span className={`badge ${doc.isCurrent ? 'success' : ''}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                          {doc.isCurrent ? 'Current' : 'Superseded'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          <Download size={12} /> Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loadingDocs && filteredDocuments.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {documents.length === 0
                          ? 'No policy documents have been published yet.'
                          : 'No policies match your search.'}
                      </td>
                    </tr>
                  )}
                  {loadingDocs && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading policy documents…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View Explorer */}
      {activeTab === 'explorer' && (
        <div>
          {/* Policy search */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}>
                <Search size={18} />
              </span>
              <input 
                type="text" 
                placeholder="Search policy sections by keyword (e.g. key control, access clearance, vetting levels)..." 
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={policySearch}
                onChange={(e) => setPolicySearch(e.target.value)}
              />
            </div>
          </div>

          {/* Policy cards grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredPolicies.map(sec => (
              <div key={sec.id} className="glass-card policy-card">
                <h3>{sec.title}</h3>
                <p style={{ lineHeight: '1.6', fontSize: '0.92rem', color: 'hsl(var(--text-primary))', whiteSpace: 'pre-line' }}>
                  {sec.content}
                </p>
                <div className="policy-highlight-container">
                  {sec.highlights.map((h, i) => (
                    <span key={i} className="policy-highlight">
                      # {h}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filteredPolicies.length === 0 && (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                No policy sections found matching that keyword search.
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Checklist */}
      {activeTab === 'checklist' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
            <div>
              <h3>Security Officer Verification Checklists</h3>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '0.25rem' }}>
                Verify physical, information, and after-hours security compliance checks.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleResetChecklist} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                <RotateCcw size={14} /> Reset
              </button>
              <button className="btn btn-primary" onClick={handleSaveChecklist} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                <Save size={14} /> Save Progress
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {localChecklists.map((item) => {
              // Get category badge color
              let badgeStyle = 'badge muted';
              if (item.category === 'Physical') badgeStyle = 'badge primary';
              if (item.category === 'Information') badgeStyle = 'badge success';
              if (item.category === 'After-Hours') badgeStyle = 'badge danger';
              if (item.category === 'Vetting') badgeStyle = 'badge warning';

              return (
                <div key={item.id} className="checklist-row">
                  <div className="checklist-left">
                    <button 
                      onClick={() => handleToggleChecklist(item.id)}
                      style={{ background: 'transparent', border: 'none', color: item.completed ? 'hsl(var(--color-success))' : 'hsl(var(--text-secondary))', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {item.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                    <div>
                      <span className={badgeStyle} style={{ marginRight: '0.5rem' }}>{item.category}</span>
                      <span className={`checklist-text ${item.completed ? 'completed' : ''}`}>
                        {item.task}
                      </span>
                    </div>
                  </div>
                  
                  {/* Notes box */}
                  <div style={{ width: '250px', marginLeft: '1rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Add observation notes..." 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      value={item.notes || ''}
                      onChange={(e) => handleNotesChange(item.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
