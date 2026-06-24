import React, { useState } from 'react';
import type { ChecklistItem } from '../types/security';
import { policySections } from '../data/mockData';
import { BookOpen, ClipboardList, Search, CheckSquare, Square, Save, RotateCcw } from 'lucide-react';

interface PolicyHubViewProps {
  checklists: ChecklistItem[];
  onUpdateChecklist: (updatedChecklist: ChecklistItem[]) => void;
}

export const PolicyHubView: React.FC<PolicyHubViewProps> = ({ checklists, onUpdateChecklist }) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'checklist'>('explorer');
  const [policySearch, setPolicySearch] = useState('');
  const [localChecklists, setLocalChecklists] = useState<ChecklistItem[]>([...checklists]);

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
    alert('Security compliance checklist states successfully saved.');
  };

  // Reset checklist state
  const handleResetChecklist = () => {
    if (window.confirm('Are you sure you want to reset all checklist items to incomplete?')) {
      const reset = localChecklists.map(item => ({ ...item, completed: false, notes: '' }));
      setLocalChecklists(reset);
      onUpdateChecklist(reset);
    }
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
