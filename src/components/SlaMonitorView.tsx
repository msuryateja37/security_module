import React from 'react';
import type { SecurityIncident } from '../types/security';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface SlaMonitorViewProps {
  incidents: SecurityIncident[];
}

export const SlaMonitorView: React.FC<SlaMonitorViewProps> = ({ incidents }) => {
  const mappedSla = incidents.map(incident => {
    const incidentDate = new Date(incident.dateTime);
    const dateReported = new Date(incident.dateReported);
    const currentDate = new Date();
    
    const hoursSinceReported = Math.floor((currentDate.getTime() - dateReported.getTime()) / (1000 * 60 * 60));
    const ackSlaPassed = hoursSinceReported > 12;
    
    const daysSinceIncident = Math.floor((currentDate.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(14 - daysSinceIncident, 0);
    const investigationSlaPassed = daysSinceIncident > 14;

    return {
      incident,
      hoursSinceReported,
      ackSlaPassed,
      daysSinceIncident,
      daysRemaining,
      investigationSlaPassed
    };
  });

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">SLA Compliance Monitor</h1>
          <p className="page-subtitle">Track DLRRD compliance thresholds: 12-hour notification reviews and 14-day investigation timelines</p>
        </div>
      </div>

      <div className="grid-cols-2" style={{ gap: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
            <AlertCircle size={22} color="hsl(var(--color-danger))" />
            12-Hour Notification SLA
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mappedSla.filter(item => item.incident.status === 'Open').map(({ incident, hoursSinceReported, ackSlaPassed }) => (
              <div 
                key={incident.id} 
                className="glass-card" 
                style={{ 
                  padding: '1rem', 
                  borderLeft: `4px solid ${ackSlaPassed ? 'hsl(var(--color-danger))' : 'hsl(var(--color-warning))'}`,
                  background: 'rgba(0,0,0,0.01)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>{incident.refNo}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: ackSlaPassed ? 'hsl(var(--color-danger))' : 'hsl(var(--color-warning))' }}>
                    {ackSlaPassed ? 'SLA Breached' : 'Within SLA'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  Reported: {incident.dateReported} ({hoursSinceReported} hours ago)
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                  <strong>Task:</strong> Officer must verify details and update status to "Under Investigation" immediately.
                </div>
              </div>
            ))}
            {mappedSla.filter(item => item.incident.status === 'Open').length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                <CheckCircle2 size={24} style={{ color: 'green', display: 'block', margin: '0 auto 0.5rem auto' }} />
                All open notifications acknowledged within the 12-hour window.
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
            <Clock size={22} color="hsl(var(--color-warning))" />
            14-Day Preliminary Investigation SLA
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mappedSla.filter(item => item.incident.status === 'Under Investigation' || item.incident.status === 'SAPS Case').map(({ incident, daysSinceIncident, daysRemaining, investigationSlaPassed }) => (
              <div 
                key={incident.id} 
                className="glass-card" 
                style={{ 
                  padding: '1rem', 
                  borderLeft: `4px solid ${investigationSlaPassed ? 'hsl(var(--color-danger))' : 'hsl(var(--color-accent))'}`,
                  background: 'rgba(0,0,0,0.01)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>{incident.refNo}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: investigationSlaPassed ? 'hsl(var(--color-danger))' : 'hsl(var(--color-accent))' }}>
                    {investigationSlaPassed ? 'SLA Expired' : `${daysRemaining} Days Left`}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  Incident Occurrence: {incident.dateTime.split('T')[0]} ({daysSinceIncident} days ago)
                </div>
                <div style={{ background: '#eee', height: '6px', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${Math.min((daysSinceIncident / 14) * 100, 100)}%`, 
                      background: investigationSlaPassed ? 'hsl(var(--color-danger))' : 'hsl(var(--color-accent))', 
                      height: '100%' 
                    }} 
                  />
                </div>
              </div>
            ))}
            {mappedSla.filter(item => item.incident.status === 'Under Investigation' || item.incident.status === 'SAPS Case').length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                <CheckCircle2 size={24} style={{ color: 'green', display: 'block', margin: '0 auto 0.5rem auto' }} />
                No active investigations currently tracked.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
