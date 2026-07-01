import React, { useState, useEffect } from 'react';
import type { PerformanceStats, ProvinceType } from '../types/security';
import { PROVINCES, MONTHS, PERFORMANCE_INDICATORS } from '../data/mockData';
import { Save } from 'lucide-react';
import { useModal } from './NotificationModal';

interface MonthlyStatsViewProps {
  stats: PerformanceStats[];
  onUpdateStats: (newStats: PerformanceStats[]) => void;
}

export const MonthlyStatsView: React.FC<MonthlyStatsViewProps> = ({ stats, onUpdateStats }) => {
  const [selectedProvince, setSelectedProvince] = useState<ProvinceType>('Gauteng');
  const [selectedMonth, setSelectedMonth] = useState<string>('Apr');
  const { showAlert } = useModal();
  
  // Working local state dictionary for the 12 indicators for the selected province & month
  const [formValues, setFormValues] = useState<{ [indicator: string]: number }>({});

  // Sync form inputs when province or month changes
  useEffect(() => {
    const values: { [indicator: string]: number } = {};
    
    PERFORMANCE_INDICATORS.forEach(indicator => {
      const match = stats.find(
        s => s.province === selectedProvince && s.indicator === indicator
      );
      values[indicator] = match ? (match.monthlyValues[selectedMonth] || 0) : 0;
    });
    
    setFormValues(values);
  }, [selectedProvince, selectedMonth, stats]);

  // Handle cell text input
  const handleInputChange = (indicator: string, valStr: string) => {
    const value = Math.max(parseInt(valStr) || 0, 0);
    setFormValues(prev => ({
      ...prev,
      [indicator]: value
    }));
  };

  // Save changes
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Map over stats, updating only the selected month values of the selected province
    const nextStats = stats.map(s => {
      if (s.province === selectedProvince && formValues[s.indicator] !== undefined) {
        return {
          ...s,
          monthlyValues: {
            ...s.monthlyValues,
            [selectedMonth]: formValues[s.indicator]
          }
        };
      }
      return s;
    });

    onUpdateStats(nextStats);
    showAlert(`Monthly Performance Statistics for ${selectedProvince} (${selectedMonth}) successfully saved.`, 'Statistics Saved', 'success');
  };

  return (
    <div>
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem', color: '#1f2937', fontWeight: 700 }}>
          Monthly Performance Statistics
        </h3>

        {/* Directorate Heading info from image3.png */}
        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem', fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4' }}>
          <strong>DIRECTORATE: PHYSICAL SECURITY AND SPECIAL EVENTS</strong><br />
          Private Bag X833, PRETORIA, 0001; 600 Lillian Ngoyi Street, PRETORIA, 0001<br />
          Tel: 012 - 312 8624; E-mail: adrian.ferreira@dalrrd.gov.za; Website: www.dalrrd.gov.za
        </div>

        <form onSubmit={handleSave}>
          {/* Province (50% or full width) */}
          <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Province</label>
              <select 
                className="form-input" 
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value as ProvinceType)}
                style={{ fontWeight: 600 }}
              >
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}></div>
          </div>

          {/* Month selector dropdown tinted green */}
          <div style={{ marginBottom: '1.5rem' }}>
            <select 
              className="form-input" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ 
                fontWeight: 600, 
                width: '180px',
                background: '#eaebeb', 
                border: '1px solid #31b399', 
                color: '#003326',
                borderRadius: '4px'
              }}
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }}></div>

          {/* Indicators Inputs Grid */}
          <div className="form-grid" style={{ rowGap: '1.25rem', columnGap: '2rem' }}>
            {PERFORMANCE_INDICATORS.map(indicator => (
              <div key={indicator} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  {indicator}
                </label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Enter"
                  value={formValues[indicator] !== undefined ? formValues[indicator] : ''}
                  onChange={(e) => handleInputChange(indicator, e.target.value)}
                  min="0"
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1.5px solid #eaebeb', paddingTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 2rem', background: '#31b399', fontWeight: 700, borderRadius: '4px' }}>
              <Save size={16} /> Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
