import { useState, useEffect } from 'react';
import type { 
  SecurityIncident, 
  PerformanceStats, 
  ChecklistItem,
  BackToOfficeReport,
  InvestigationReport,
  QuarterlyReport,
  TraAudit
} from './types/security';
import { DashboardView } from './components/DashboardView';
import { RegisterView } from './components/RegisterView';
import { ReportIncidentView } from './components/ReportIncidentView';
import { MonthlyStatsView } from './components/MonthlyStatsView';
import { BackToOfficeView } from './components/BackToOfficeView';
import { InvestigationReportView } from './components/InvestigationReportView';
import { MonthlyQuarterlyReportView } from './components/MonthlyQuarterlyReportView';
import { TraChecklistView } from './components/TraChecklistView';
import { MyCasesView } from './components/MyCasesView';
import { ApprovalView } from './components/ApprovalView';
import { SlaMonitorView } from './components/SlaMonitorView';
import { ReportsArchiveView } from './components/ReportsArchiveView';
import { AdministrationView } from './components/AdministrationView';
import { LoginView } from './components/LoginView';
import { 
  LayoutDashboard, 
  FileText, 
  Briefcase,
  ClipboardCheck,
  Clock,
  Archive,
  Settings,
  LogOut,
  Search,
  Bell
} from 'lucide-react';


function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [submitReportSubView, setSubmitReportSubView] = useState<'incident' | 'bto' | 'investigation' | 'stats' | 'quarterly' | 'tra'>('bto');
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('dlrrd_logged_in_user');
  });

  // Database States loaded from LocalStorage or mock seeds
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [stats, setStats] = useState<PerformanceStats[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  
  // New document and form states matching screens docx
  const [btoReports, setBtoReports] = useState<BackToOfficeReport[]>([]);
  const [invReports, setInvReports] = useState<InvestigationReport[]>([]);
  const [qtrReports, setQtrReports] = useState<QuarterlyReport[]>([]);
  const [traAudits, setTraAudits] = useState<TraAudit[]>([]);

  // Search, Notifications, Profile, and Settings states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 'notif-1', title: 'New incident logged', message: 'A theft was reported in Pretoria HQ, Block B.', time: '10m ago', read: false },
    { id: 'notif-2', title: 'TRA checklist completed', message: 'Gauteng Regional Office audit submitted by Supervisor.', time: '1h ago', read: true },
    { id: 'notif-3', title: 'SLA Breach Alert', message: 'Case DLRRD/SEC/2026/001 requires outcome updates.', time: '4h ago', read: false },
    { id: 'notif-4', title: 'System Maintenance', message: 'Azure SQL DB migration schedule on Saturday.', time: '1d ago', read: true }
  ]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }
    
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setSearchResults(json.data);
          setShowSearchResults(true);
        }
      })
      .catch(err => {
        console.error('Search failed:', err);
      });
  };

  // Initial Load & LocalStorage-to-Database Migration
  useEffect(() => {
    const localIncidents = localStorage.getItem('dlrrd_incidents');
    const localStats = localStorage.getItem('dlrrd_stats');
    const localChecklists = localStorage.getItem('dlrrd_checklists');
    const localBto = localStorage.getItem('dlrrd_bto');
    const localInv = localStorage.getItem('dlrrd_inv');
    const localQtr = localStorage.getItem('dlrrd_qtr');
    const localTra = localStorage.getItem('dlrrd_tra');

    const migrateData = async () => {
      console.log('Detected existing LocalStorage data. Starting automated migration to SQL database...');

      // 1. Migrate Incidents
      if (localIncidents) {
        try {
          const parsed = JSON.parse(localIncidents);
          for (const inc of parsed) {
            await fetch('/api/incidents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(inc)
            });
          }
          localStorage.removeItem('dlrrd_incidents');
        } catch (e) {
          console.error('Migration failed for incidents:', e);
        }
      }

      // 2. Migrate Stats
      if (localStats) {
        try {
          const parsed = JSON.parse(localStats);
          await fetch('/api/stats', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
          });
          localStorage.removeItem('dlrrd_stats');
        } catch (e) {
          console.error('Migration failed for stats:', e);
        }
      }

      // 3. Migrate Checklists
      if (localChecklists) {
        try {
          const parsed = JSON.parse(localChecklists);
          await fetch('/api/checklists', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
          });
          localStorage.removeItem('dlrrd_checklists');
        } catch (e) {
          console.error('Migration failed for checklists:', e);
        }
      }

      // 4. Migrate BTO Reports
      if (localBto) {
        try {
          const parsed = JSON.parse(localBto);
          for (const r of parsed) {
            await fetch('/api/bto-reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
            });
          }
          localStorage.removeItem('dlrrd_bto');
        } catch (e) {
          console.error('Migration failed for BTO reports:', e);
        }
      }

      // 5. Migrate Investigation Reports
      if (localInv) {
        try {
          const parsed = JSON.parse(localInv);
          for (const r of parsed) {
            await fetch('/api/investigation-reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
            });
          }
          localStorage.removeItem('dlrrd_inv');
        } catch (e) {
          console.error('Migration failed for investigation reports:', e);
        }
      }

      // 6. Migrate Quarterly Reports
      if (localQtr) {
        try {
          const parsed = JSON.parse(localQtr);
          for (const r of parsed) {
            await fetch('/api/quarterly-reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
            });
          }
          localStorage.removeItem('dlrrd_qtr');
        } catch (e) {
          console.error('Migration failed for quarterly reports:', e);
        }
      }

      // 7. Migrate TRA Audits
      if (localTra) {
        try {
          const parsed = JSON.parse(localTra);
          for (const r of parsed) {
            await fetch('/api/tra-audits', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(r)
            });
          }
          localStorage.removeItem('dlrrd_tra');
        } catch (e) {
          console.error('Migration failed for TRA audits:', e);
        }
      }

      console.log('Automated migration completed. Loading fresh records from database...');
      loadFromDatabase();
    };

    const loadFromDatabase = () => {
      // Load Incidents
      fetch('/api/incidents')
        .then(res => res.json())
        .then(json => {
          if (json.success) setIncidents(json.data);
        })
        .catch(err => console.error('Error loading incidents:', err));

      // Load Stats
      fetch('/api/stats')
        .then(res => res.json())
        .then(json => {
          if (json.success) setStats(json.data);
        })
        .catch(err => console.error('Error loading stats:', err));

      // Load Checklists
      fetch('/api/checklists')
        .then(res => res.json())
        .then(json => {
          if (json.success) setChecklists(json.data);
        })
        .catch(err => console.error('Error loading checklists:', err));

      // Load BTO Reports
      fetch('/api/bto-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setBtoReports(json.data);
        })
        .catch(err => console.error('Error loading BTO reports:', err));

      // Load Investigation Reports
      fetch('/api/investigation-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setInvReports(json.data);
        })
        .catch(err => console.error('Error loading investigation reports:', err));

      // Load Quarterly Reports
      fetch('/api/quarterly-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setQtrReports(json.data);
        })
        .catch(err => console.error('Error loading quarterly reports:', err));

      // Load TRA Audits
      fetch('/api/tra-audits')
        .then(res => res.json())
        .then(json => {
          if (json.success) setTraAudits(json.data);
        })
        .catch(err => console.error('Error loading TRA audits:', err));
    };

    const needsMigration = !!(localIncidents || localStats || localChecklists || localBto || localInv || localQtr || localTra);
    if (needsMigration) {
      migrateData();
    } else {
      loadFromDatabase();
    }
  }, []);

  // Update handlers
  const handleUpdateIncident = (updated: SecurityIncident) => {
    fetch(`/api/incidents/${updated.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updated)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        setIncidents(prev => prev.map(inc => inc.id === updated.id ? updated : inc));
      }
    })
    .catch(err => console.error('Error updating incident:', err));
  };

  const handleApproveIncident = (id: string, update: Partial<SecurityIncident>) => {
    fetch(`/api/incidents/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(update)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, ...update } : inc));
      }
    })
    .catch(err => console.error('Error approving incident:', err));
  };

  const handleAddIncident = (newIncident: SecurityIncident) => {
    fetch('/api/incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newIncident)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        setIncidents(prev => [newIncident, ...prev]);
        
        // Handle incrementing incident stats
        const incidentDate = new Date(newIncident.dateTime);
        const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthsShort[incidentDate.getMonth()];
        
        const nextStats = stats.map(s => {
          if (s.province === newIncident.province && s.indicator === 'Security Breaches reported') {
            return {
              ...s,
              monthlyValues: {
                ...s.monthlyValues,
                [monthName]: (s.monthlyValues[monthName] || 0) + 1
              }
            };
          }
          return s;
        });
        setStats(nextStats);
        
        // Update stats on server
        fetch('/api/stats', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextStats)
        }).catch(err => console.error('Error syncing stats:', err));
      }
    })
    .catch(err => console.error('Error adding incident:', err));
  };

  const handleUpdateStats = (newStats: PerformanceStats[]) => {
    fetch('/api/stats', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newStats)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setStats(newStats);
    })
    .catch(err => console.error('Error saving stats:', err));
  };

  const handleUpdateChecklist = (newChecklist: ChecklistItem[]) => {
    fetch('/api/checklists', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newChecklist)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setChecklists(newChecklist);
    })
    .catch(err => console.error('Error saving checklist:', err));
  };

  // Submit handlers for the new design screens
  const handleAddBtoReport = (report: BackToOfficeReport) => {
    fetch('/api/bto-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setBtoReports(prev => [report, ...prev]);
    })
    .catch(err => console.error('Error adding BTO report:', err));
  };

  const handleAddInvReport = (report: InvestigationReport) => {
    fetch('/api/investigation-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setInvReports(prev => [report, ...prev]);
    })
    .catch(err => console.error('Error adding investigation report:', err));
  };

  const handleAddQtrReport = (report: QuarterlyReport) => {
    fetch('/api/quarterly-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setQtrReports(prev => [report, ...prev]);
    })
    .catch(err => console.error('Error adding quarterly report:', err));
  };

  const handleAddTraAudit = (report: TraAudit) => {
    fetch('/api/tra-audits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) setTraAudits(prev => [report, ...prev]);
    })
    .catch(err => console.error('Error adding TRA audit:', err));
  };

  const getTopbarTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Dashboard';
      case 'submit_reports': return 'Submit Security Reports';
      case 'my_cases': return 'My Assigned Cases';
      case 'register': return 'Investigation';
      case 'approval': return 'Approval';
      case 'sla_monitor': return 'SLA Monitor';
      case 'reports_archive': return 'Reports';
      case 'administration': return 'Administration';
      default: return 'CD: Security Services';
    }
  };

  if (!currentUser) {
    return (
      <LoginView 
        onLoginSuccess={(username) => {
          setCurrentUser(username);
          localStorage.setItem('dlrrd_logged_in_user', username);
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Logo Card Section */}
          <div className="logo-white-card">
            <svg className="logo-white-card-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(14, 77, 65, 0.15)" stroke="#003326" />
              <circle cx="12" cy="11" r="3" fill="#31b399" />
              <path d="M12 2v20M2 11h20" stroke="#003326" strokeWidth="0.5" />
            </svg>
            <div className="logo-white-card-text">
              <span className="logo-dept">rural development<br/>& land reform</span>
              <span style={{ fontSize: '0.45rem', color: '#6b7280', margin: '0.1rem 0', fontWeight: 500, lineHeight: 1.1 }}>Department: Rural Development and Land Reform</span>
              <span className="logo-republic">REPUBLIC OF SOUTH AFRICA</span>
            </div>
          </div>

          <ul className="nav-links" style={{ marginTop: '1rem' }}>
            <li>
              <button 
                onClick={() => setActiveView('dashboard')}
                className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                <span className="nav-text">Dashboard</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('submit_reports')}
                className={`nav-link ${activeView === 'submit_reports' ? 'active' : ''}`}
              >
                <FileText size={18} />
                <span className="nav-text">Submit Reports</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('my_cases')}
                className={`nav-link ${activeView === 'my_cases' ? 'active' : ''}`}
              >
                <Briefcase size={18} />
                <span className="nav-text">My Assigned Cases</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('register')}
                className={`nav-link ${activeView === 'register' ? 'active' : ''}`}
              >
                <Search size={18} />
                <span className="nav-text">Investigation</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('approval')}
                className={`nav-link ${activeView === 'approval' ? 'active' : ''}`}
              >
                <ClipboardCheck size={18} />
                <span className="nav-text">Approval</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('sla_monitor')}
                className={`nav-link ${activeView === 'sla_monitor' ? 'active' : ''}`}
              >
                <Clock size={18} />
                <span className="nav-text">SLA Monitor</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('reports_archive')}
                className={`nav-link ${activeView === 'reports_archive' ? 'active' : ''}`}
              >
                <Archive size={18} />
                <span className="nav-text">Reports</span>
              </button>
            </li>

            <li>
              <button 
                onClick={() => setActiveView('administration')}
                className={`nav-link ${activeView === 'administration' ? 'active' : ''}`}
              >
                <Settings size={18} />
                <span className="nav-text">Administration</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Translucent bottom area containing Logout */}
        <div className="logout-container-bottom" style={{ marginBottom: '0.5rem' }}>
          <button 
            onClick={() => { 
              localStorage.removeItem('dlrrd_logged_in_user');
              setCurrentUser(null);
              setActiveView('dashboard');
            }}
            className="nav-link logout-btn-capsule"
          >
            <LogOut size={18} />
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </nav>

      {/* Persistent global layout container */}
      <div style={{ marginLeft: 'var(--sidebar-width)', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', width: 'calc(100% - var(--sidebar-width))' }}>
        
        {/* Topbar Header */}
        <header className="global-topbar" style={{ position: 'relative' }}>
          <div className="topbar-left">
            <h2 className="topbar-title">{getTopbarTitle()}</h2>
          </div>
          <div className="topbar-right">
            <div className="topbar-search-container">
              <Search className="topbar-search-icon" size={16} />
              <input 
                type="text" 
                className="topbar-search-input" 
                placeholder="Search database (incidents, BTO, TRA)..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            
            <button className="topbar-btn" onClick={() => setShowSettingsDrawer(true)} title="System Settings">
              <Settings size={18} />
            </button>
            
            <button 
              className="topbar-btn" 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileCard(false);
                setShowSearchResults(false);
              }}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {notifications.some(n => !n.read) && (
                <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', background: 'var(--color-accent)', borderRadius: '50%' }}></span>
              )}
            </button>
            
            <div 
              className="topbar-profile" 
              onClick={() => {
                setShowProfileCard(!showProfileCard);
                setShowNotifications(false);
                setShowSearchResults(false);
              }}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="profile-avatar">
                {currentUser ? currentUser.charAt(0).toUpperCase() : 'S'}
              </div>
              <div className="profile-info">
                <span className="profile-name" style={{ textTransform: 'capitalize' }}>
                  {currentUser || 'supervisor'}
                </span>
                <span className="profile-role">Senior Security Supervisor</span>
              </div>
            </div>
          </div>

          {/* Search Dropdown Overlay */}
          {showSearchResults && searchResults && (
            <div className="search-results-dropdown">
              <div className="search-results-header">
                <span>Search Results for "{searchQuery}"</span>
                <button onClick={() => setShowSearchResults(false)} className="search-close-btn">&times;</button>
              </div>
              <div className="search-results-body">
                {searchResults.incidents && searchResults.incidents.length > 0 && (
                  <div className="search-section">
                    <h4>Incidents ({searchResults.incidents.length})</h4>
                    <ul>
                      {searchResults.incidents.map((inc: any) => (
                        <li key={inc.id} onClick={() => {
                          setActiveView('register');
                          setShowSearchResults(false);
                        }}>
                          <div className="search-item-title">{inc.refNo} - {inc.place}</div>
                          <div className="search-item-desc">{inc.natureOfLoss}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {searchResults.btoReports && searchResults.btoReports.length > 0 && (
                  <div className="search-section">
                    <h4>Back to Office Reports ({searchResults.btoReports.length})</h4>
                    <ul>
                      {searchResults.btoReports.map((rep: any) => (
                        <li key={rep.id} onClick={() => {
                          setActiveView('reports_archive');
                          setShowSearchResults(false);
                        }}>
                          <div className="search-item-title">{rep.eventName} - {rep.officialName}</div>
                          <div className="search-item-desc">{rep.venue} ({rep.date})</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {searchResults.investigationReports && searchResults.investigationReports.length > 0 && (
                  <div className="search-section">
                    <h4>Investigation Reports ({searchResults.investigationReports.length})</h4>
                    <ul>
                      {searchResults.investigationReports.map((rep: any) => (
                        <li key={rep.id} onClick={() => {
                          setActiveView('reports_archive');
                          setShowSearchResults(false);
                        }}>
                          <div className="search-item-title">{rep.subject}</div>
                          <div className="search-item-desc">Officer: {rep.officerName} | Rank: {rep.rank}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {searchResults.traAudits && searchResults.traAudits.length > 0 && (
                  <div className="search-section">
                    <h4>TRA Checklist Audits ({searchResults.traAudits.length})</h4>
                    <ul>
                      {searchResults.traAudits.map((rep: any) => (
                        <li key={rep.id} onClick={() => {
                          setActiveView('reports_archive');
                          setShowSearchResults(false);
                        }}>
                          <div className="search-item-title">{rep.officeName}</div>
                          <div className="search-item-desc">Assessor: {rep.assessorName} | Location: {rep.officeLocation}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(!searchResults.incidents || searchResults.incidents.length === 0) &&
                 (!searchResults.btoReports || searchResults.btoReports.length === 0) &&
                 (!searchResults.investigationReports || searchResults.investigationReports.length === 0) &&
                 (!searchResults.traAudits || searchResults.traAudits.length === 0) && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    No matching records found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications Dropdown Overlay */}
          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="dropdown-header">
                <span>Notifications</span>
                <button 
                  onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} 
                  className="dropdown-action-btn"
                >
                  Mark all read
                </button>
              </div>
              <div className="dropdown-body">
                {notifications.map(notif => (
                  <div key={notif.id} className={`notification-item ${notif.read ? 'read' : 'unread'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-time">{notif.time}</div>
                    </div>
                    <div className="notification-message">{notif.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profile Dropdown Overlay */}
          {showProfileCard && (
            <div className="profile-dropdown-card">
              <div className="profile-dropdown-header">
                <div className="profile-avatar large">S</div>
                <div className="profile-dropdown-info">
                  <h4 style={{ textTransform: 'capitalize', margin: 0 }}>{currentUser || 'supervisor'}</h4>
                  <p style={{ margin: '0.1rem 0 0 0' }}>Senior Security Supervisor</p>
                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', margin: '0.1rem 0 0 0' }}>supervisor@dlrrd.gov.za</p>
                </div>
              </div>
              <div className="profile-dropdown-body">
                <div className="profile-field">
                  <span className="profile-field-label">Department</span>
                  <span className="profile-field-val">Security & Facilities Management Services</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Office Location</span>
                  <span className="profile-field-val">Pretoria Headquarters</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Security Cleared Level</span>
                  <span className="profile-field-val badge success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', width: 'fit-content' }}>Secret</span>
                </div>
              </div>
              <div className="profile-dropdown-footer">
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem' }} 
                  onClick={() => alert('Password reset link sent to supervisor@dlrrd.gov.za')}
                >
                  Reset Password
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="main-content" style={{ flexGrow: 1, padding: '2rem' }}>
          {activeView === 'dashboard' && (
            <DashboardView 
              incidents={incidents} 
              stats={stats} 
              onNavigate={(view) => {
                if (view === 'report') {
                  setActiveView('submit_reports');
                  setSubmitReportSubView('incident');
                } else {
                  setActiveView(view);
                }
              }} 
            />
          )}

          {activeView === 'submit_reports' && (
            <div>
              {/* Horizontal Tabs to switch report forms */}
              <div className="horizontal-tab-bar">
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'incident' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('incident')}
                >
                  Incident Notification
                </button>
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'bto' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('bto')}
                >
                  Back to Office Report
                </button>
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'investigation' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('investigation')}
                >
                  Investigation Report
                </button>
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'stats' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('stats')}
                >
                  Monthly Performance Statistics
                </button>
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'quarterly' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('quarterly')}
                >
                  Monthly & Quarterly Report
                </button>
                <button 
                  className={`horizontal-tab ${submitReportSubView === 'tra' ? 'active' : ''}`}
                  onClick={() => setSubmitReportSubView('tra')}
                >
                  TRA Checklist
                </button>
              </div>

              {/* Form rendering */}
              {submitReportSubView === 'incident' && (
                <ReportIncidentView 
                  onAddIncident={handleAddIncident} 
                  onNavigate={(view) => {
                    if (view === 'register') {
                      setActiveView('register');
                    }
                  }} 
                />
              )}
              {submitReportSubView === 'bto' && (
                <BackToOfficeView 
                  reports={btoReports}
                  onSubmitReport={handleAddBtoReport}
                />
              )}
              {submitReportSubView === 'investigation' && (
                <InvestigationReportView 
                  reports={invReports}
                  onSubmitReport={handleAddInvReport}
                />
              )}
              {submitReportSubView === 'stats' && (
                <MonthlyStatsView 
                  stats={stats} 
                  onUpdateStats={handleUpdateStats} 
                />
              )}
              {submitReportSubView === 'quarterly' && (
                <MonthlyQuarterlyReportView 
                  reports={qtrReports}
                  onSubmitReport={handleAddQtrReport}
                />
              )}
              {submitReportSubView === 'tra' && (
                <TraChecklistView 
                  reports={traAudits}
                  onSubmitReport={handleAddTraAudit}
                />
              )}
            </div>
          )}

          {activeView === 'register' && (
            <RegisterView 
              incidents={incidents} 
              onUpdateIncident={handleUpdateIncident} 
            />
          )}

          {activeView === 'my_cases' && (
            <MyCasesView 
              incidents={incidents} 
              onSelectCase={(incident) => {
                console.log('Selected case:', incident.id);
                setActiveView('register');
              }} 
            />
          )}

          {activeView === 'approval' && (
            <ApprovalView 
              incidents={incidents}
              btoReports={btoReports}
              invReports={invReports}
              onApproveIncident={handleApproveIncident}
            />
          )}

          {activeView === 'sla_monitor' && (
            <SlaMonitorView 
              incidents={incidents} 
            />
          )}

          {activeView === 'reports_archive' && (
            <ReportsArchiveView 
              btoReports={btoReports}
              invReports={invReports}
              qtrReports={qtrReports}
              traAudits={traAudits}
            />
          )}

          {activeView === 'administration' && (
            <AdministrationView 
              checklists={checklists} 
              onUpdateChecklist={handleUpdateChecklist} 
            />
          )}
        </main>
      </div>

      {/* Settings slide-over drawer overlay */}
      {showSettingsDrawer && (
        <div className="drawer-backdrop" onClick={() => setShowSettingsDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>System Settings</h3>
              <button onClick={() => setShowSettingsDrawer(false)} className="search-close-btn" style={{ fontSize: '1.5rem' }}>&times;</button>
            </div>
            <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Database Integration
                </h4>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Active Database Engine</label>
                  <input type="text" className="form-input" value="Azure SQL Database (Microsoft SQL Server)" disabled style={{ opacity: 0.8 }} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Data Auto-Migration</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input type="checkbox" defaultChecked disabled />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automated SQLite-to-Cloud replication</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Biometric & Perimeter Controls
                </h4>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="checkbox-label" style={{ fontSize: '0.75rem' }}>
                    <input type="checkbox" defaultChecked />
                    Enable multi-factor biometric check during off-hours filing
                  </label>
                  <label className="checkbox-label" style={{ fontSize: '0.75rem' }}>
                    <input type="checkbox" defaultChecked />
                    Trigger automated SAPS notification on major armed breach
                  </label>
                  <label className="checkbox-label" style={{ fontSize: '0.75rem' }}>
                    <input type="checkbox" />
                    Require secondary signature for Top Secret document classification
                  </label>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  Vetting Rules & SLA Limits
                </h4>
                <div className="form-grid" style={{ gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>SAPS CAS Logging SLA (hrs)</label>
                    <input type="number" className="form-input" defaultValue={24} style={{ fontSize: '0.8rem' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Preliminary Report Deadline (days)</label>
                    <input type="number" className="form-input" defaultValue={7} style={{ fontSize: '0.8rem' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="drawer-footer">
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                alert('Settings successfully updated.');
                setShowSettingsDrawer(false);
              }}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
