import React, { useState } from 'react';
import type { SecurityIncident } from '../types/security';
import { Briefcase, AlertTriangle, Clock, ShieldCheck, CheckCircle2, Eye, Search } from 'lucide-react';

interface MyCasesViewProps {
  incidents: SecurityIncident[];
  onSelectCase: (incident: SecurityIncident) => void;
}

export const MyCasesView: React.FC<MyCasesViewProps> = ({ incidents, onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const myCases = incidents.filter(incident => {
    const searchMatch = 
      incident.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.place.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.province.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.status.toLowerCase().includes(searchTerm.toLowerCase());
      
    return searchMatch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open':
        return <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />;
      case 'Under Investigation':
        return <Clock size={18} style={{ color: 'var(--color-warning)' }} />;
      case 'SAPS Case':
        return <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />;
      default:
        return <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Open': return 'danger';
      case 'Under Investigation': return 'warning';
      case 'SAPS Case': return 'primary';
      default: return 'success';
    }
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">My Assigned Cases</h1>
          <p className="page-subtitle">Manage and update active security cases assigned to your portfolio</p>
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
              placeholder="Search cases by reference number, province, place or status..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Case Details</th>
                <th>Province</th>
                <th>Place of Occurrence</th>
                <th>Value of Loss</th>
                <th>Status</th>
                <th>Classification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myCases.map(incident => (
                <tr key={incident.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {incident.refNo}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Reported: {incident.dateReported}
                      </span>
                    </div>
                  </td>
                  <td>{incident.province}</td>
                  <td>{incident.place}</td>
                  <td>R {incident.lossValue.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getStatusIcon(incident.status)}
                      <span className={`badge ${getStatusClass(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>
                      {incident.classification}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => onSelectCase(incident)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Eye size={12} /> View File
                    </button>
                  </td>
                </tr>
              ))}
              {myCases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Briefcase size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p>No assigned cases found matching search criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
