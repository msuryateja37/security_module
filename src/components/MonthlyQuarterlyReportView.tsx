import React, { useState, useEffect } from 'react';
import type { QuarterlyReport, QuarterlyIndicatorValue } from '../types/security';
import { PROVINCES } from '../data/mockData';
import { Save, History, Plus } from 'lucide-react';
import { useModal } from './NotificationModal';

interface MonthlyQuarterlyReportViewProps {
  reports: QuarterlyReport[];
  onSubmitReport: (newReport: QuarterlyReport) => void;
}

const QUARTERLY_INDICATORS = [
  'Number of Information Security audit/risk assessment plans and implemented.',
  '% of Pre- employment screening of employees and companies.',
  '% of vetting forms issued to employees',
  '% of preliminary investigation reported and submitted.',
  'Number of offices monitored to ensure implementation of effective physical security plan.',
  '% of security guarding service contracts monitored.',
  '% of offices monitored on Circular 14 of 2013 in line with Key Control Procedures implemented.',
  '% provision of safety and security special at events',
  'Number of DLRRD offices monitored to ensure compliance with OHS Act and policy.',
  '% of compliance to Minimum Information Security Standard (MISS) monitored.',
  '% of reported security breach incident investigated.',
  '% implementation of Security threat and Risk assessment recommendations.'
];

export const MonthlyQuarterlyReportView: React.FC<MonthlyQuarterlyReportViewProps> = ({ reports, onSubmitReport }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { showAlert } = useModal();

  // Header states
  const [province, setProvince] = useState<string>('Gauteng');
  const [quarterNumber, setQuarterNumber] = useState('Q1');
  const [year, setYear] = useState('2026');
  const [program, setProgram] = useState('Security Administration');
  const [branch, setBranch] = useState('Security and Facilities Management Services');

  // Indicator values state dictionary
  const [indicatorValues, setIndicatorValues] = useState<{ [indName: string]: QuarterlyIndicatorValue }>({});

  // Initialize indicator values dictionary
  useEffect(() => {
    const initValues: { [indName: string]: QuarterlyIndicatorValue } = {};
    QUARTERLY_INDICATORS.forEach(name => {
      initValues[name] = {
        annualTarget: 0,
        quarterTarget: 0,
        monthlyTarget: 0,
        actualQuarterPerformance: 0,
        month1Val: 0,
        month2Val: 0,
        month3Val: 0,
        varianceReasons: '',
        correctiveAction: ''
      };
    });
    setIndicatorValues(initValues);
  }, []);

  const handleValueChange = (indicator: string, field: keyof QuarterlyIndicatorValue, value: any) => {
    setIndicatorValues(prev => {
      const current = prev[indicator] || {
        annualTarget: 0, quarterTarget: 0, monthlyTarget: 0, actualQuarterPerformance: 0,
        month1Val: 0, month2Val: 0, month3Val: 0, varianceReasons: '', correctiveAction: ''
      };
      const updated = { ...current, [field]: value };
      
      // Auto compute actual quarter performance if month values updated
      if (['month1Val', 'month2Val', 'month3Val'].includes(field)) {
        updated.actualQuarterPerformance = (Number(updated.month1Val) || 0) + (Number(updated.month2Val) || 0) + (Number(updated.month3Val) || 0);
      }

      return {
        ...prev,
        [indicator]: updated
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!province || !quarterNumber || !year) {
      showAlert('Please fill in required fields (Province, Quarter, and Year).', 'Validation Error', 'warning');
      return;
    }

    const report: QuarterlyReport = {
      id: `qtr-${Date.now()}`,
      province,
      quarterNumber,
      year,
      program,
      branch,
      indicatorValues,
      dateCreated: new Date().toISOString().split('T')[0]
    };

    onSubmitReport(report);
    
    // Reset indicators
    const clearedValues: { [indName: string]: QuarterlyIndicatorValue } = {};
    QUARTERLY_INDICATORS.forEach(name => {
      clearedValues[name] = {
        annualTarget: 0,
        quarterTarget: 0,
        monthlyTarget: 0,
        actualQuarterPerformance: 0,
        month1Val: 0,
        month2Val: 0,
        month3Val: 0,
        varianceReasons: '',
        correctiveAction: ''
      };
    });
    setIndicatorValues(clearedValues);
    showAlert('Monthly and Quarterly Investigation Report successfully compiled.', 'Report Compiled', 'success');
  };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Security Monthly and Quarterly Report</h1>
          <p className="page-subtitle">Compile targets, monthly actual outcomes, and variances for physical and info security plans</p>
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
            Submitted Monthly and Quarterly Reports
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
                    Quarterly Investigation Report ({rep.quarterNumber} - {rep.year})
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    Province: {rep.province} | Compiled: {rep.dateCreated}
                  </span>
                </div>

                <div className="form-grid" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Program: </span>
                    <span>{rep.program}</span>
                  </div>
                  <div>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Branch: </span>
                    <span>{rep.branch}</span>
                  </div>
                </div>

                {/* Show summary of first 2 indicators */}
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  {Object.entries(rep.indicatorValues).slice(0, 3).map(([name, vals]) => (
                    <div key={name} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontWeight: 500 }}>{name}</div>
                      <div style={{ display: 'flex', gap: '1rem', color: 'hsl(var(--text-secondary))', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <span>Target: {vals.quarterTarget}</span>
                        <span>Month 1: {vals.month1Val}</span>
                        <span>Month 2: {vals.month2Val}</span>
                        <span>Month 3: {vals.month3Val}</span>
                        <span style={{ color: 'hsl(var(--color-success))' }}>Actual Qtr: {vals.actualQuarterPerformance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-muted))' }}>
                No quarterly reports submitted yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Header Metadata */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem' }}>
              Report Metadata Parameters
            </h3>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Province *</label>
                <select 
                  className="form-input" 
                  value={province} 
                  onChange={(e) => setProvince(e.target.value)}
                  style={{ fontWeight: 600 }}
                >
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p} Province</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quarterly Report Number *</label>
                <select 
                  className="form-input" 
                  value={quarterNumber} 
                  onChange={(e) => setQuarterNumber(e.target.value)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="Q1">Quarter 1 (April - June)</option>
                  <option value="Q2">Quarter 2 (July - September)</option>
                  <option value="Q3">Quarter 3 (October - December)</option>
                  <option value="Q4">Quarter 4 (January - March)</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Financial Year *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Program</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={program}
                  onChange={(e) => setProgram(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Branch</label>
              <input 
                type="text" 
                className="form-input" 
                value={branch}
                onChange={(e) => setBranch(e.target.value)} 
              />
            </div>
          </div>

          {/* Header metadata layout */}
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Province</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter province"
                  value={province} 
                  onChange={(e) => setProvince(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Quarterly Report Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter number"
                  value={quarterNumber} 
                  onChange={(e) => setQuarterNumber(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Year</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter year"
                  value={year} 
                  onChange={(e) => setYear(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Program</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={program} 
                  onChange={(e) => setProgram(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Branch</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter"
                  value={branch} 
                  onChange={(e) => setBranch(e.target.value)} 
                />
              </div>
              <div className="form-group"></div>
            </div>
          </div>

          {/* Master layout for target performance metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {QUARTERLY_INDICATORS.map((indicator, index) => {
              const activeVals = indicatorValues[indicator] || {
                annualTarget: 0,
                quarterTarget: 0,
                monthlyTarget: 0,
                actualQuarterPerformance: 0,
                month1Val: 0,
                month2Val: 0,
                month3Val: 0,
                varianceReasons: '',
                correctiveAction: ''
              };

              return (
                <div key={indicator} className="glass-card" style={{ padding: '1.75rem', border: '1px solid hsl(var(--border-color))' }}>
                  <div className="indicator-header">
                    <span className="indicator-number-badge">{index + 1}</span>
                    <span className="indicator-title-text">{indicator}</span>
                  </div>

                  {/* Row 1: Annual Target & Quarter Target */}
                  <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Annual Target Number for Province</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="Enter"
                        value={activeVals.annualTarget || ''}
                        onChange={(e) => handleValueChange(indicator, 'annualTarget', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Quarter Target Number</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="Enter"
                        value={activeVals.quarterTarget || ''}
                        onChange={(e) => handleValueChange(indicator, 'quarterTarget', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Monthly target stacked & Actual performance */}
                  <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Monthly target</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', minWidth: '55px', color: 'hsl(var(--text-secondary))' }}>Month 1</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Enter"
                            value={activeVals.month1Val || ''}
                            onChange={(e) => handleValueChange(indicator, 'month1Val', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', minWidth: '55px', color: 'hsl(var(--text-secondary))' }}>Month 2</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Enter"
                            value={activeVals.month2Val || ''}
                            onChange={(e) => handleValueChange(indicator, 'month2Val', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', minWidth: '55px', color: 'hsl(var(--text-secondary))' }}>Month 3</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Enter"
                            value={activeVals.month3Val || ''}
                            onChange={(e) => handleValueChange(indicator, 'month3Val', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>Actual Performance for Quarter Number</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="Enter"
                        style={{ background: 'rgba(16, 185, 129, 0.03)', fontWeight: 700 }}
                        value={activeVals.actualQuarterPerformance || ''}
                        onChange={(e) => handleValueChange(indicator, 'actualQuarterPerformance', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Row 3: Reasons for Variance (100%) */}
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Reasons for Variance</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter"
                      value={activeVals.varianceReasons || ''}
                      onChange={(e) => handleValueChange(indicator, 'varianceReasons', e.target.value)}
                    />
                  </div>

                  {/* Row 4: Corrective Action Plan (100%) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Corrective Action Plan</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter"
                      value={activeVals.correctiveAction || ''}
                      onChange={(e) => handleValueChange(indicator, 'correctiveAction', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '2px solid #eaebeb', paddingTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 2.5rem', background: '#31b399', fontWeight: 700, borderRadius: '4px' }}>
              <Save size={16} /> Submit
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
