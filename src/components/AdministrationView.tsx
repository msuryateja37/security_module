import React, { useState } from 'react';
import type { ChecklistItem } from '../types/security';
import { CheckSquare, Users, Save } from 'lucide-react';
import { useModal } from './NotificationModal';

interface AdministrationViewProps {
  checklists: ChecklistItem[];
  onUpdateChecklist: (updatedChecklist: ChecklistItem[]) => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({ checklists, onUpdateChecklist }) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'staff'>('checklist');
  const [localChecklists, setLocalChecklists] = useState<ChecklistItem[]>(checklists);
  const { showAlert } = useModal();

  React.useEffect(() => {
    setLocalChecklists(checklists);
  }, [checklists]);

  const handleToggleCheck = (id: string) => {
    const updated = localChecklists.map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });
    setLocalChecklists(updated);
  };

  const handleNotesChange = (id: string, notes: string) => {
    const updated = localChecklists.map(item => {
      if (item.id === id) {
        return { ...item, notes };
      }
      return item;
    });
    setLocalChecklists(updated);
  };

  const handleSaveChecklist = () => {
    onUpdateChecklist(localChecklists);
    showAlert('Operational compliance checklist successfully saved.', 'Checklist Saved', 'success');
  };

  const securityPersonnel = [
    { name: 'Mandla Mnguni', role: 'Security Manager', clearance: 'Top Secret', status: 'Cleared', date: '2028-11-20' },
    { name: 'A. Ferreira', role: 'Senior Security Inspector', clearance: 'Secret', status: 'Cleared', date: '2027-05-12' },
    { name: 'S. Sithole', role: 'Security Officer', clearance: 'Restricted', status: 'In Progress', date: '2026-08-30' },
    { name: 'Lerato K.', role: 'Senior Clerk', clearance: 'Confidential', status: 'Expired', date: '2025-12-15' },
    { name: 'FN Aphane', role: 'Deputy Director', clearance: 'Top Secret', status: 'Cleared', date: '2029-01-25' }
  ];

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Administration Hub</h1>
          <p className="page-subtitle">Manage operational checklists, audit task compliance, and monitor personnel security vetting</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('checklist')}
          className={`btn ${activeTab === 'checklist' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Operational Checklist
        </button>
        <button 
          onClick={() => setActiveTab('staff')}
          className={`btn ${activeTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Personnel Security & Vetting
        </button>
      </div>

      {activeTab === 'checklist' ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={20} color="hsl(var(--color-primary))" />
              Standard Compliance Checklist
            </h3>
            <button className="btn btn-primary" onClick={handleSaveChecklist} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Save size={14} /> Save Checklist Changes
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {localChecklists.map(item => (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: item.completed ? 'rgba(40,143,19,0.01)' : 'rgba(0,0,0,0.01)' }}
              >
                <input 
                  type="checkbox" 
                  checked={item.completed} 
                  onChange={() => handleToggleCheck(item.id)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '0.2rem' }}
                />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: item.completed ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {item.task}
                    </span>
                    <span className="badge primary" style={{ fontSize: '0.7rem' }}>{item.category}</span>
                  </div>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Add audit notes or findings..." 
                    value={item.notes || ''}
                    onChange={(e) => handleNotesChange(item.id, e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', marginTop: '0.25rem' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Users size={20} color="var(--color-primary)" />
            Security Staff Vetting Register (POPIA & PSC)
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Designation / Role</th>
                  <th>Required Clearance</th>
                  <th>Vetting Status</th>
                  <th>Expiration Date</th>
                </tr>
              </thead>
              <tbody>
                {securityPersonnel.map((person, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{person.name}</td>
                    <td>{person.role}</td>
                    <td>
                      <span className="badge primary">{person.clearance}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        person.status === 'Cleared' ? 'success' : 
                        person.status === 'In Progress' ? 'warning' : 'danger'
                      }`}>
                        {person.status}
                      </span>
                    </td>
                    <td>{person.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
