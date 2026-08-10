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
import type { AppView, ReportSubView, UserProfile } from './security/roleAccess';
import {
  canAccessReportTab,
  canAccessView,
  getDefaultReportTabForRole,
  getDefaultViewForRole,
  getViewLabelForRole,
  NAV_ITEMS,
  REPORT_TABS,
  reviveStoredUser
} from './security/roleAccess';
import { DashboardView } from './components/DashboardView';
import { RegisterView } from './components/RegisterView';
import { ReportIncidentView } from './components/ReportIncidentView';
import { MonthlyStatsView } from './components/MonthlyStatsView';
import { BackToOfficeView } from './components/BackToOfficeView';
import { InvestigationReportView } from './components/InvestigationReportView';
import { MonthlyQuarterlyReportView } from './components/MonthlyQuarterlyReportView';
import { TraChecklistView } from './components/TraChecklistView';
import { MyCasesView } from './components/MyCasesView';
import { AllIncidentsView } from './components/AllIncidentsView';
import { CaseDetailView } from './components/CaseDetailView';
import { ApprovalView } from './components/ApprovalView';
import { SlaMonitorView } from './components/SlaMonitorView';
import { ReportsArchiveView } from './components/ReportsArchiveView';
import { AdministrationView } from './components/AdministrationView';
import { PolicyHubView } from './components/PolicyHubView';
import { AssistantView } from './components/AssistantView';
import type { ChatMessage } from './components/AssistantView';
import { LoginView } from './components/LoginView';
import { ProfileView } from './components/ProfileView';
import { Avatar } from './components/Avatar';
import { LeavesView } from './components/LeavesView';
import { LeaveManagementView } from './components/LeaveManagementView';
import { relativeTime } from './utils/workdays';
import { Breadcrumbs, BreadcrumbTailProvider } from './components/Breadcrumbs';
import type { Crumb } from './components/Breadcrumbs';
import type { AppNotification } from './types/leave';
import {
  Bell,
  Menu,
  X,
  UserRound,
  LogOut
} from 'lucide-react';
import { useModal } from './components/NotificationModal';

function App() {
  const { showAlert } = useModal();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return reviveStoredUser(localStorage.getItem('dlrrd_logged_in_user'));
  });
  // Case file deep-link (#/case/<id>) — the id of the case open in CaseDetailView
  const [caseDetailId, setCaseDetailId] = useState<string | null>(() => {
    const match = window.location.hash.match(/^#\/?case\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const [activeView, setActiveView] = useState<AppView>(() => {
    const user = reviveStoredUser(localStorage.getItem('dlrrd_logged_in_user'));
    if (user && window.location.hash.match(/^#\/?case\/(.+)$/)) {
      return 'case_detail';
    }
    const hash = window.location.hash.replace('#/', '').replace('#', '') as AppView;
    const isValidView = hash && ['dashboard', 'submit_reports', 'my_cases', 'incidents', 'register', 'approval', 'sla_monitor', 'reports_archive', 'assistant', 'policy', 'administration', 'profile', 'leaves', 'leave_management'].includes(hash);
    if (user) {
      return isValidView && canAccessView(user.role, hash) ? hash : getDefaultViewForRole(user.role);
    }
    return 'dashboard';
  });
  const [submitReportSubView, setSubmitReportSubView] = useState<ReportSubView>(() => {
    const user = reviveStoredUser(localStorage.getItem('dlrrd_logged_in_user'));
    return user ? getDefaultReportTabForRole(user.role) : 'incident';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Breadcrumb trail — views with internal tabs publish their sub-location
  // through the BreadcrumbTailProvider; App builds the leading crumbs.
  const [breadcrumbTail, setBreadcrumbTail] = useState<Crumb[]>([]);
  // The view a case file was opened from (My Cases, Approval, …) so the
  // breadcrumb and its parent link lead back to where the user came from.
  const [caseOrigin, setCaseOrigin] = useState<AppView | null>(null);

  // URL Hash Routing synchronization
  useEffect(() => {
    const handleHashChange = () => {
      // Case file deep-links: #/case/<incidentId>
      const caseMatch = window.location.hash.match(/^#\/?case\/(.+)$/);
      if (caseMatch && currentUser) {
        setCaseDetailId(decodeURIComponent(caseMatch[1]));
        setActiveView('case_detail');
        return;
      }

      const hash = window.location.hash.replace('#/', '').replace('#', '') as AppView;
      const isValidView = ['dashboard', 'submit_reports', 'my_cases', 'incidents', 'register', 'approval', 'sla_monitor', 'reports_archive', 'assistant', 'policy', 'administration', 'profile', 'leaves', 'leave_management'].includes(hash);

      if (isValidView && currentUser && canAccessView(currentUser.role, hash)) {
        setActiveView(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      window.location.hash = activeView === 'case_detail' && caseDetailId
        ? `#/case/${encodeURIComponent(caseDetailId)}`
        : `#/${activeView}`;
    } else {
      window.location.hash = '';
    }
  }, [activeView, currentUser, caseDetailId]);

  const openCaseFile = (incidentId: string) => {
    if (activeView !== 'case_detail') {
      setCaseOrigin(activeView);
    }
    setCaseDetailId(incidentId);
    setActiveView('case_detail');
  };

  // Forget the case origin once the user is no longer on a case file
  useEffect(() => {
    if (activeView !== 'case_detail') {
      setCaseOrigin(null);
    }
  }, [activeView]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeView, submitReportSubView]);

  useEffect(() => {
    if (!currentUser) return;

    if (!canAccessView(currentUser.role, activeView)) {
      setActiveView(getDefaultViewForRole(currentUser.role));
      return;
    }

    if (activeView === 'submit_reports' && !canAccessReportTab(currentUser.role, submitReportSubView)) {
      setSubmitReportSubView(getDefaultReportTabForRole(currentUser.role));
    }
  }, [activeView, currentUser, submitReportSubView]);

  // Database States loaded from LocalStorage or mock seeds
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [stats, setStats] = useState<PerformanceStats[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  
  // New document and form states matching screens docx
  const [btoReports, setBtoReports] = useState<BackToOfficeReport[]>([]);
  const [invReports, setInvReports] = useState<InvestigationReport[]>([]);
  const [qtrReports, setQtrReports] = useState<QuarterlyReport[]>([]);
  const [traAudits, setTraAudits] = useState<TraAudit[]>([]);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Search, Notifications, Profile, and Settings states
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  // Which tab the profile page opens on ('security' when arriving via Change Password)
  const [profileInitialTab, setProfileInitialTab] = useState<'personal' | 'role' | 'security' | 'preferences'>('personal');

  // Close topbar dropdowns when clicking anywhere outside them.
  // Trigger elements are excluded so their own onClick toggles keep working.
  useEffect(() => {
    if (!showProfileCard && !showNotifications) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showProfileCard && !target.closest('.topbar-profile') && !target.closest('.profile-dropdown-card')) {
        setShowProfileCard(false);
      }
      if (showNotifications && !target.closest('.topbar-notif-btn') && !target.closest('.notifications-dropdown')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showProfileCard, showNotifications]);

  // Close topbar dropdowns when navigating to a different screen
  useEffect(() => {
    setShowProfileCard(false);
    setShowNotifications(false);
  }, [activeView]);

  // Draft prepared by the SIMS Assistant, waiting for user review in the incident form
  const [assistantDraft, setAssistantDraft] = useState<Partial<SecurityIncident> | null>(null);
  const [assistantDraftVersion, setAssistantDraftVersion] = useState(0);
  // Assistant conversation — kept here (memory only, never persisted) so it survives
  // navigating to the incident form and back; cleared once the drafted incident is submitted.
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);

  // In-app notification feed — persisted server-side (FR-008), polled so leave
  // decisions, acting-coordinator activations etc. appear without a reload.
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; time: string; read: boolean; link?: string | null }[]>([]);

  // The current user's profile photo, loaded once here and shared everywhere it
  // is shown (top bar, profile dropdown, Profile page). The image is served by an
  // authenticated endpoint, so an <img src> can't fetch it directly — we pull the
  // bytes as a blob and expose an object URL. Re-runs whenever the stored avatar
  // path changes (including right after an upload), so every avatar stays in sync.
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      'x-username': currentUser?.username || '',
      'x-user-role': currentUser?.role || ''
    };
    return fetch(url, { ...options, headers });
  };

  // Load and poll the persisted notification feed
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const loadNotifications = () => {
      authFetch('/api/notifications')
        .then(res => res.json())
        .then(json => {
          if (cancelled || !json.success) return;
          setNotifications((json.data as AppNotification[]).map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            time: relativeTime(n.dateCreated),
            read: !!n.isRead,
            link: n.link
          })));
        })
        .catch(err => console.error('Error loading notifications:', err));
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Load the current user's profile photo whenever the stored path changes.
  useEffect(() => {
    if (!currentUser?.avatarUrl) {
      setAvatarObjectUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/auth/avatar');
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarObjectUrl(objectUrl);
      } catch {
        /* keep the initial-letter fallback */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.avatarUrl, currentUser?.username]);

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    authFetch('/api/notifications/read-all', { method: 'PUT' })
      .catch(err => console.error('Error marking notifications read:', err));
  };

  const handleOpenNotification = (notif: { id: string; read: boolean; link?: string | null }) => {
    if (!notif.read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      authFetch(`/api/notifications/${encodeURIComponent(notif.id)}/read`, { method: 'PUT' })
        .catch(err => console.error('Error marking notification read:', err));
    }
    if (notif.link) {
      window.location.hash = notif.link.replace(/^#\/?/, '#/');
      setShowNotifications(false);
    }
  };


  // Initial Load & LocalStorage-to-Database Migration
  useEffect(() => {
    if (!currentUser) return;

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
            await authFetch('/api/incidents', {
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
          await authFetch('/api/stats', {
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
          await authFetch('/api/checklists', {
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
            await authFetch('/api/bto-reports', {
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
            await authFetch('/api/investigation-reports', {
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
            await authFetch('/api/quarterly-reports', {
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
            await authFetch('/api/tra-audits', {
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
      authFetch('/api/incidents')
        .then(res => res.json())
        .then(json => {
          if (json.success) setIncidents(json.data);
        })
        .catch(err => console.error('Error loading incidents:', err));

      // Load Stats
      authFetch('/api/stats')
        .then(res => res.json())
        .then(json => {
          if (json.success) setStats(json.data);
        })
        .catch(err => console.error('Error loading stats:', err));

      // Load Checklists
      authFetch('/api/checklists')
        .then(res => res.json())
        .then(json => {
          if (json.success) setChecklists(json.data);
        })
        .catch(err => console.error('Error loading checklists:', err));

      // Load BTO Reports
      authFetch('/api/bto-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setBtoReports(json.data);
        })
        .catch(err => console.error('Error loading BTO reports:', err));

      // Load Investigation Reports
      authFetch('/api/investigation-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setInvReports(json.data);
        })
        .catch(err => console.error('Error loading investigation reports:', err));

      // Load Quarterly Reports
      authFetch('/api/quarterly-reports')
        .then(res => res.json())
        .then(json => {
          if (json.success) setQtrReports(json.data);
        })
        .catch(err => console.error('Error loading quarterly reports:', err));

      // Load TRA Audits
      authFetch('/api/tra-audits')
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
  }, [currentUser]);

  // Reload the incident list from the server (used after workflow actions on the case file page)
  const refreshIncidents = () => {
    authFetch('/api/incidents')
      .then(res => res.json())
      .then(json => {
        if (json.success) setIncidents(json.data);
      })
      .catch(err => console.error('Error reloading incidents:', err));
  };

  // Update handlers
  const handleUpdateIncident = (updated: SecurityIncident) => {
    authFetch(`/api/incidents/${updated.id}`, {
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

  // Returns whether the server accepted the incident so the report form can
  // upload supporting documents against the new case before confirming.
  const handleAddIncident = (newIncident: SecurityIncident): Promise<boolean> => {
    return authFetch('/api/incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newIncident)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        // Server assigns routing (responsiblePerson) and workflow stage — use its copy
        setIncidents(prev => [json.data || newIncident, ...prev]);

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
        authFetch('/api/stats', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextStats)
        }).catch(err => console.error('Error syncing stats:', err));
        return true;
      }
      return false;
    })
    .catch(err => {
      console.error('Error adding incident:', err);
      return false;
    });
  };

  const handleUpdateStats = (newStats: PerformanceStats[]) => {
    authFetch('/api/stats', {
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
    authFetch('/api/checklists', {
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
    authFetch('/api/bto-reports', {
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
    authFetch('/api/investigation-reports', {
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
    authFetch('/api/quarterly-reports', {
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
    // Optimistically update state so the record is immediately visible as In Progress in Signed Records
    setTraAudits(prev => [report, ...prev.filter(r => r.id !== report.id)]);

    authFetch('/api/tra-audits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        // Trust the server-persisted record (carries ownerId + status), and fall
        // back to the optimistic one if the payload is ever missing.
        const saved: TraAudit = json.data && json.data.id ? json.data : report;
        setTraAudits(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
      } else {
        showAlert(json.error || json.message || 'The TRA checklist could not be saved. Please try again.', 'Save Failed', 'danger');
        refreshTraAudits();
      }
    })
    .catch(err => {
      console.error('Error adding TRA audit:', err);
      showAlert('Could not reach the server to save the TRA checklist. Please try again.', 'Save Failed', 'danger');
      refreshTraAudits();
    });
  };

  // Replace a TRA record in place (e.g. after a manager counter-signs it).
  const handleUpdateTraAudit = (updated: TraAudit) => {
    setTraAudits(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  };

  // Reload TRA audits from the server (keeps the Signed Records list authoritative).
  const refreshTraAudits = () => {
    authFetch('/api/tra-audits')
      .then(res => res.json())
      .then(json => { if (json.success) setTraAudits(json.data); })
      .catch(err => console.error('Error refreshing TRA audits:', err));
  };

  /** Ends the session and clears everything user-scoped (sidebar + profile page). */
  const handleLogout = () => {
    localStorage.removeItem('dlrrd_logged_in_user');
    setCurrentUser(null);
    setActiveView('dashboard');
    setSubmitReportSubView('incident');
    setAssistantMessages([]);
    setAssistantDraft(null);
  };

  const getTopbarTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Dashboard';
      case 'submit_reports': return 'Submit Security Reports';
      case 'my_cases': return currentUser ? getViewLabelForRole('my_cases', currentUser.role) : 'My Assigned Cases';
      case 'incidents': return 'All Incidents';
      case 'register': return 'Investigation';
      case 'approval': return 'Approval';
      case 'sla_monitor': return 'SLA Monitor';
      case 'reports_archive': return 'Reports';
      case 'assistant': return 'AI Assistant';
      case 'administration': return 'Administration';
      case 'profile': return 'My Profile';
      case 'leaves': return 'Leaves Management';
      case 'leave_management': return 'Leave Management';
      case 'case_detail': return 'Case File';
      case 'tra_checklist': return 'Threat & Risk Assessment (TRA)';
      case 'bto_report': return 'Back to Office Report';
      default: return 'CD: Security Services';
    }
  };

  // Breadcrumb trail: Home › section › (sub-location published by the view).
  // Overlays (drawers, modals) are not part of the trail — only page-level navigation.
  const getBreadcrumbs = (): Crumb[] => {
    if (!currentUser) return [];

    const home: Crumb = { label: 'Home', onClick: () => navigateToView('dashboard') };

    if (activeView === 'dashboard') {
      return [{ label: 'Home' }];
    }

    if (activeView === 'case_detail') {
      // The fallback must also be access-checked — roles without 'my_cases' (e.g. Deputy
      // Director) would otherwise be sent to a view that renders nothing.
      const origin: AppView =
        caseOrigin && caseOrigin !== 'case_detail' && canAccessView(currentUser.role, caseOrigin)
          ? caseOrigin
          : canAccessView(currentUser.role, 'my_cases')
            ? 'my_cases'
            : getDefaultViewForRole(currentUser.role);
      return [
        home,
        {
          label: getViewLabelForRole(origin, currentUser.role),
          onClick: () => {
            setCaseDetailId(null);
            setActiveView(origin);
          }
        },
        ...(breadcrumbTail.length > 0 ? breadcrumbTail : [{ label: 'Case File' }])
      ];
    }

    if (activeView === 'submit_reports') {
      const tabLabel = REPORT_TABS.find(tab => tab.view === submitReportSubView)?.label;
      return [
        home,
        {
          label: 'Submit Reports',
          onClick: () => setSubmitReportSubView(getDefaultReportTabForRole(currentUser.role))
        },
        ...(tabLabel ? [{ label: tabLabel }] : [])
      ];
    }

    return [
      home,
      {
        label: getViewLabelForRole(activeView, currentUser.role),
        onClick: () => setActiveView(activeView)
      },
      ...breadcrumbTail
    ];
  };

  const navigateToView = (view: string) => {
    if (!currentUser) return;

    const requestedView = view === 'report' ? 'submit_reports' : view;
    if (canAccessView(currentUser.role, requestedView as AppView)) {
      setActiveView(requestedView as AppView);
    }
  };

  const allowedNavItems = currentUser ? NAV_ITEMS.filter(item => item.roles.includes(currentUser.role)) : [];
  const allowedReportTabs = currentUser ? REPORT_TABS.filter(tab => tab.roles.includes(currentUser.role)) : [];

  if (!currentUser) {
    return (
      <LoginView 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveView(getDefaultViewForRole(user.role));
          setSubmitReportSubView(getDefaultReportTabForRole(user.role));
          localStorage.setItem('dlrrd_logged_in_user', JSON.stringify(user));
        }} 
      />
    );
  }

  return (
    <BreadcrumbTailProvider value={setBreadcrumbTail}>
    <div className="app-container">
      {/* Sidebar Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Logo Card Section */}
          <div className="logo-white-card">
            <img className="logo-white-card-img" src="/logo_with_name.png" alt="DLRRD Logo" />
          </div>

          <ul className="nav-links" style={{ marginTop: '1rem' }}>
            {allowedNavItems.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.view}>
                  <button
                    onClick={() => setActiveView(item.view)}
                    className={`nav-link ${activeView === item.view ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    <span className="nav-text">{getViewLabelForRole(item.view, currentUser.role)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bottom user identity card — click to open profile. Logout sits beneath it,
            separated from the functional modules as an account action (CI-0014). */}
        <div className="sidebar-user-container">
          <button
            type="button"
            className="sidebar-user-card"
            onClick={() => setActiveView('profile')}
            title="View profile"
          >
            <span className="sidebar-user-avatar">
              <Avatar src={avatarObjectUrl} name={currentUser.displayName} />
            </span>
            <span className="sidebar-user-meta">
              <span className="sidebar-user-name">{currentUser.displayName}</span>
              <span className="sidebar-user-role">{currentUser.roleLabel}</span>
              <span className="sidebar-user-province">{currentUser.province}</span>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Sign out of SIMS"
          >
            <LogOut size={16} />
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </nav>

      {/* Persistent global layout container */}
      <div className={`main-layout-container${activeView === 'assistant' ? ' viewport-locked' : ''}`} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* Topbar Header */}
        <header className="global-topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              className="menu-toggle-btn" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Menu"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="topbar-title">{getTopbarTitle()}</h2>
          </div>
          <div className="topbar-right">
            <button
              className="topbar-btn topbar-notif-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileCard(false);
              }}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {notifications.some(n => !n.read) && (
                <span className="notif-count-badge">
                  {(() => { const c = notifications.filter(n => !n.read).length; return c > 99 ? '99+' : c; })()}
                </span>
              )}
            </button>
            
            <div 
              className="topbar-profile" 
              onClick={() => {
                setShowProfileCard(!showProfileCard);
                setShowNotifications(false);
              }}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="profile-avatar">
                <Avatar src={avatarObjectUrl} name={currentUser.displayName} />
              </div>
              <div className="profile-info">
                <span className="profile-name" style={{ textTransform: 'capitalize' }}>
                  {currentUser.displayName}
                </span>
                <span className="profile-role">{currentUser.roleLabel}</span>
              </div>
            </div>
          </div>


          {/* Notifications Dropdown Overlay */}
          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="dropdown-header">
                <span>Notifications</span>
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="dropdown-action-btn"
                >
                  Mark all read
                </button>
              </div>
              <div className="dropdown-body">
                {notifications.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    No notifications yet.
                  </div>
                )}
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                    onClick={() => handleOpenNotification(notif)}
                    style={{ cursor: notif.link || !notif.read ? 'pointer' : 'default' }}
                  >
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
                <div className="profile-avatar large"><Avatar src={avatarObjectUrl} name={currentUser.displayName} /></div>
                <div className="profile-dropdown-info">
                  <h4 style={{ textTransform: 'capitalize', margin: 0 }}>{currentUser.displayName}</h4>
                  <p style={{ margin: '0.1rem 0 0 0' }}>{currentUser.roleLabel}</p>
                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', margin: '0.1rem 0 0 0' }}>{currentUser.email}</p>
                </div>
              </div>
              <div className="profile-dropdown-body">
                <div className="profile-field">
                  <span className="profile-field-label">Department</span>
                  <span className="profile-field-val">Security & Facilities Management Services</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Office Location</span>
                  <span className="profile-field-val">{currentUser.office}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Province Scope</span>
                  <span className="profile-field-val">{currentUser.province}</span>
                </div>
              </div>
              <div className="profile-dropdown-footer">
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  onClick={() => {
                    setShowProfileCard(false);
                    setProfileInitialTab('personal');
                    setActiveView('profile');
                  }}
                >
                  <UserRound size={14} />
                  View Profile
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="main-content" style={{ flexGrow: 1 }}>
          <Breadcrumbs items={getBreadcrumbs()} />

          {activeView === 'dashboard' && (
            <DashboardView
              incidents={incidents}
              currentUser={currentUser}
              traAudits={traAudits}
              onNavigate={(view) => {
                if (view === 'report') {
                  navigateToView('submit_reports');
                  if (canAccessReportTab(currentUser.role, 'incident')) {
                    setSubmitReportSubView('incident');
                  }
                } else if (view === 'stats') {
                  navigateToView('submit_reports');
                  if (canAccessReportTab(currentUser.role, 'stats')) {
                    setSubmitReportSubView('stats');
                  }
                } else if (view.startsWith('case:')) {
                  const caseId = view.split(':')[1];
                  openCaseFile(caseId);
                } else {
                  navigateToView(view as any);
                }
              }} 
            />
          )}

          {activeView === 'submit_reports' && canAccessView(currentUser.role, 'submit_reports') && (
            <div>
              {/* Horizontal Tabs to switch report forms */}
              {allowedReportTabs.length > 1 && (
                <div className="horizontal-tab-bar">
                  {allowedReportTabs.map(tab => (
                    <button
                      key={tab.view}
                      className={`horizontal-tab ${submitReportSubView === tab.view ? 'active' : ''}`}
                      onClick={() => setSubmitReportSubView(tab.view)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Form rendering */}
              {submitReportSubView === 'incident' && canAccessReportTab(currentUser.role, 'incident') && (
                <ReportIncidentView
                  key={`incident-form-${assistantDraftVersion}`}
                  initialData={assistantDraft ?? undefined}
                  onAddIncident={(incident) => {
                    // The assistant-drafted report is now submitted — clear the draft
                    // and the assistant conversation that produced it.
                    if (assistantDraft) {
                      setAssistantMessages([]);
                    }
                    setAssistantDraft(null);
                    return handleAddIncident(incident);
                  }}
                  currentUser={currentUser}
                  onNavigate={navigateToView}
                />
              )}
              {submitReportSubView === 'bto' && canAccessReportTab(currentUser.role, 'bto') && (
                <BackToOfficeView 
                  reports={btoReports}
                  onSubmitReport={handleAddBtoReport}
                />
              )}
              {submitReportSubView === 'investigation' && canAccessReportTab(currentUser.role, 'investigation') && (
                <InvestigationReportView 
                  reports={invReports}
                  onSubmitReport={handleAddInvReport}
                />
              )}
              {submitReportSubView === 'stats' && canAccessReportTab(currentUser.role, 'stats') && (
                <MonthlyStatsView 
                  stats={stats} 
                  onUpdateStats={handleUpdateStats} 
                />
              )}
              {submitReportSubView === 'quarterly' && canAccessReportTab(currentUser.role, 'quarterly') && (
                <MonthlyQuarterlyReportView 
                  reports={qtrReports}
                  onSubmitReport={handleAddQtrReport}
                />
              )}
              {submitReportSubView === 'tra' && canAccessReportTab(currentUser.role, 'tra') && (
                <TraChecklistView
                  reports={traAudits}
                  onSubmitReport={handleAddTraAudit}
                  onUpdateReport={handleUpdateTraAudit}
                  authFetch={authFetch}
                  currentUser={currentUser}
                />
              )}
            </div>
          )}

          {activeView === 'register' && canAccessView(currentUser.role, 'register') && (
            <RegisterView 
              incidents={incidents} 
              onUpdateIncident={handleUpdateIncident} 
              initialSelectedIncidentId={selectedIncidentId}
              onCloseSelectedIncident={() => setSelectedIncidentId(null)}
            />
          )}

          {activeView === 'my_cases' && canAccessView(currentUser.role, 'my_cases') && (
            <MyCasesView
              incidents={incidents}
              currentUser={currentUser}
              onUpdateIncident={handleUpdateIncident}
              onSelectCase={(incident) => openCaseFile(incident.id)}
            />
          )}

          {activeView === 'incidents' && canAccessView(currentUser.role, 'incidents') && (
            <AllIncidentsView
              incidents={incidents}
              currentUser={currentUser}
              onOpenCase={(incident) => openCaseFile(incident.id)}
              authFetch={authFetch}
              onChanged={refreshIncidents}
            />
          )}

          {activeView === 'case_detail' && (
            caseDetailId ? (
              <CaseDetailView
                incidentId={caseDetailId}
                currentUser={currentUser}
                onBack={() => {
                  setCaseDetailId(null);
                  setActiveView(canAccessView(currentUser.role, 'my_cases') ? 'my_cases' : getDefaultViewForRole(currentUser.role));
                }}
                onChanged={refreshIncidents}
              />
            ) : (
              // 'case_detail' always passes canAccessView, so a missing id would otherwise
              // leave the whole page blank with no guard to recover it.
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>No case selected</h3>
                <p style={{ marginBottom: '1.5rem' }}>This case file could not be opened because no incident reference was supplied.</p>
                <button className="btn btn-secondary" onClick={() => setActiveView(getDefaultViewForRole(currentUser.role))}>
                  Back to {getViewLabelForRole(getDefaultViewForRole(currentUser.role), currentUser.role)}
                </button>
              </div>
            )
          )}

          {activeView === 'approval' && canAccessView(currentUser.role, 'approval') && (
            <ApprovalView
              incidents={incidents}
              btoReports={btoReports}
              invReports={invReports}
              currentUser={currentUser}
              onOpenCase={(incident) => openCaseFile(incident.id)}
            />
          )}

          {activeView === 'sla_monitor' && canAccessView(currentUser.role, 'sla_monitor') && (
            <SlaMonitorView 
              incidents={incidents} 
            />
          )}

          {activeView === 'reports_archive' && canAccessView(currentUser.role, 'reports_archive') && (
            <ReportsArchiveView 
              btoReports={btoReports}
              invReports={invReports}
              qtrReports={qtrReports}
              traAudits={traAudits}
              stats={stats}
              onUpdateStats={handleUpdateStats}
              onSaveQuarterlyReport={handleAddQtrReport}
              incidents={incidents}
              currentUser={currentUser}
            />
          )}

          {activeView === 'tra_checklist' && canAccessView(currentUser.role, 'tra_checklist') && (
            <TraChecklistView
              reports={traAudits}
              onSubmitReport={handleAddTraAudit}
              onUpdateReport={handleUpdateTraAudit}
              authFetch={authFetch}
              currentUser={currentUser}
            />
          )}

          {activeView === 'bto_report' && canAccessView(currentUser.role, 'bto_report') && (
            <BackToOfficeView 
              reports={btoReports}
              onSubmitReport={handleAddBtoReport}
            />
          )}

          {activeView === 'administration' && canAccessView(currentUser.role, 'administration') && (
            <AdministrationView
              checklists={checklists}
              onUpdateChecklist={handleUpdateChecklist}
              currentUser={currentUser}
            />
          )}

          {activeView === 'assistant' && canAccessView(currentUser.role, 'assistant') && (
            <AssistantView
              currentUser={currentUser}
              messages={assistantMessages}
              onMessagesChange={setAssistantMessages}
              onPrefillIncident={(draft) => {
                setAssistantDraft(draft);
                setAssistantDraftVersion(v => v + 1);
                setSubmitReportSubView('incident');
                navigateToView('submit_reports');
              }}
            />
          )}

          {activeView === 'leaves' && canAccessView(currentUser.role, 'leaves') && (
            <LeavesView currentUser={currentUser} />
          )}

          {activeView === 'leave_management' && canAccessView(currentUser.role, 'leave_management') && (
            <LeaveManagementView currentUser={currentUser} />
          )}

          {activeView === 'policy' && canAccessView(currentUser.role, 'policy') && (
            <PolicyHubView
              checklists={checklists}
              onUpdateChecklist={handleUpdateChecklist}
              currentUser={currentUser}
            />
          )}

          {activeView === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              initialTab={profileInitialTab}
              avatarObjectUrl={avatarObjectUrl}
              onUserUpdated={(user) => {
                setCurrentUser(user);
                localStorage.setItem('dlrrd_logged_in_user', JSON.stringify(user));
              }}
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
                showAlert('Settings successfully updated.', 'Settings Saved', 'success');
                setShowSettingsDrawer(false);
              }}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </BreadcrumbTailProvider>
  );
}

export default App;
