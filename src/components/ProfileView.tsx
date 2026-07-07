import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import type { Permission, UserPreferences, UserProfile } from '../security/roleAccess';
import {
  DEFAULT_PREFERENCES,
  getPermissionsForRole,
  getViewLabelForRole,
  isNationalRole,
  isProvincialRole,
  NAV_ITEMS,
  ROLE_LABELS
} from '../security/roleAccess';
import { useModal } from './NotificationModal';

export type ProfileTab = 'personal' | 'role' | 'security' | 'preferences';

interface ProfileViewProps {
  currentUser: UserProfile;
  initialTab?: ProfileTab;
  onUserUpdated: (user: UserProfile) => void;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  details?: string;
}

// Human-readable descriptions for the RBAC permission keys (client responsibility matrix)
const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'dashboard:view': 'View the role-based dashboard and statistics',
  'incident:create': 'Report / register security incidents',
  'incident:track_own': 'Track the status of own reported incidents',
  'incident:view_province': 'View all incidents within own province',
  'incident:view_assigned': 'View cases assigned by the Chief Director',
  'incident:view_all': 'View incidents across all nine provinces (national scope)',
  'incident:update': 'Update incident records and investigation status',
  'case:approve': 'Approve case reports and outcomes',
  'case:close': 'Close cases with outcome classification',
  'case:escalate': 'Escalate significant cases for national review',
  'case:assign_investigator': 'Assign cases to the Chief Investigator',
  'investigation:submit': 'Submit preliminary / final investigation reports',
  'investigation:approve': 'Approve investigation findings and closure',
  'reports:submit_operational': 'Submit operational reports (BTO, stats, TRA, quarterly)',
  'reports:view_archive': 'View the reports archive and registers',
  'sla:view': 'Monitor SLA compliance and escalations',
  'admin:manage_roles': 'Administer users, roles and temporary assignments',
  'ai:chat': 'Use the SIMS AI Assistant'
};

// MISS-aligned explanations of the personnel clearance levels
const CLEARANCE_DESCRIPTIONS: Record<UserProfile['clearanceLevel'], string> = {
  'Public': 'Access to public information only.',
  'Restricted': 'Access to information whose disclosure could be disadvantageous to the department.',
  'Confidential': 'Access to information whose disclosure could prejudice departmental interests.',
  'Secret': 'Access to information whose disclosure could seriously prejudice state interests.',
  'Top Secret': 'Access to information that could be used by hostile elements to neutralise departmental or state objectives.'
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, initialTab = 'personal', onUserUpdated }) => {
  const { showAlert } = useModal();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Personal details (self-editable subset — identity fields are AD/HR-sourced, FR-005)
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber || '');
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...DEFAULT_PREFERENCES,
    ...(currentUser.preferences || {})
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Own audit-trail activity (FR-035)
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const authFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'x-username': currentUser.username,
        'x-user-role': currentUser.role
      }
    });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab !== 'security' || activityLoaded) return;
    authFetch('/api/auth/my-activity')
      .then(res => res.json())
      .then(json => {
        if (json.success) setActivity(json.data);
        setActivityLoaded(true);
      })
      .catch(() => setActivityLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activityLoaded]);

  const permissions = getPermissionsForRole(currentUser.role);
  const accessibleScreens = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));

  const dataScope = isNationalRole(currentUser.role)
    ? 'National — incidents and registers across all nine provinces'
    : isProvincialRole(currentUser.role)
      ? `Provincial — restricted to ${currentUser.province} (FR-033 data segregation)`
      : currentUser.role === 'chief_security_investigator'
        ? 'Assigned cases only — cases routed by the Chief Director'
        : 'Own records only — incidents you reported';

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ phoneNumber, jobTitle })
      });
      const json = await res.json();
      if (json.success && json.data) {
        onUserUpdated(json.data);
        showAlert('Your personal details were updated and the change was recorded in the audit trail.', 'Profile Updated', 'success');
      } else {
        showAlert(json.message || json.error || 'Failed to update profile.', 'Update Failed', 'danger');
      }
    } catch {
      showAlert('Could not reach the server. Please try again.', 'Update Failed', 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const res = await authFetch('/api/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences)
      });
      const json = await res.json();
      if (json.success && json.data) {
        onUserUpdated(json.data);
        showAlert('Notification preferences saved.', 'Preferences Saved', 'success');
      } else {
        showAlert(json.message || json.error || 'Failed to save preferences.', 'Save Failed', 'danger');
      }
    } catch {
      showAlert('Could not reach the server. Please try again.', 'Save Failed', 'danger');
    } finally {
      setSavingPreferences(false);
    }
  };

  const readOnlyField = (label: string, value: string, Icon: React.ElementType) => (
    <div className="form-group">
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Icon size={13} /> {label}
        <span className="profile-managed-tag">AD / HR managed</span>
      </label>
      <input type="text" className="form-input" value={value || '—'} disabled style={{ opacity: 0.75 }} />
    </div>
  );

  return (
    <div className="profile-page">
      {/* ===== Header summary card ===== */}
      <div className="profile-page-header">
        <div className="profile-avatar xlarge">{currentUser.displayName.charAt(0).toUpperCase()}</div>
        <div className="profile-page-header-info">
          <h2 style={{ textTransform: 'capitalize' }}>{currentUser.displayName}</h2>
          <div className="profile-page-header-badges">
            <span className="badge role-badge"><ShieldCheck size={12} /> {currentUser.roleLabel} ({currentUser.roleCode})</span>
            <span className="badge clearance-badge"><Lock size={12} /> {currentUser.clearanceLevel}</span>
          </div>
          <div className="profile-page-header-meta">
            <span><Mail size={13} /> {currentUser.email}</span>
            <span><MapPin size={13} /> {currentUser.province} · {currentUser.office}</span>
            {currentUser.persalNumber && <span><Fingerprint size={13} /> PERSAL {currentUser.persalNumber}</span>}
          </div>
        </div>
        <div className="profile-page-header-side">
          <div className="profile-meta-line"><Clock size={13} /> Last sign-in: {formatDateTime(currentUser.lastLoginAt)}</div>
          <div className="profile-meta-line"><KeyRound size={13} /> Password: managed by Azure Active Directory (SSO)</div>
        </div>
      </div>

      {/* Acting-assignment banner (temporary Security Coordinator cover) */}
      {currentUser.baseRole && (
        <div className="profile-acting-banner">
          <BadgeCheck size={16} />
          <span>
            You are currently acting as <strong>Temporary Security Coordinator</strong> (appointed by {currentUser.tempAssignedBy || 'the Chief Director'}).
            Your permanent role is <strong>{ROLE_LABELS[currentUser.baseRole]}</strong>.
          </span>
        </div>
      )}

      {/* ===== Tabs ===== */}
      <div className="horizontal-tab-bar" style={{ marginTop: '1.25rem' }}>
        <button className={`horizontal-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>Personal Details</button>
        <button className={`horizontal-tab ${activeTab === 'role' ? 'active' : ''}`} onClick={() => setActiveTab('role')}>Role & Access</button>
        <button className={`horizontal-tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security</button>
        <button className={`horizontal-tab ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>Preferences</button>
      </div>

      {/* ===== Personal Details ===== */}
      {activeTab === 'personal' && (
        <div className="profile-tab-panel">
          <h3 className="profile-section-title"><UserRound size={16} /> Personal Details</h3>
          <p className="profile-section-note">
            Identity details are synchronised from the departmental Active Directory and PERSAL (FR-005) and cannot be
            edited here. Contact the System Administrator (ICT/MTS) to correct them.
          </p>

          <div className="form-grid">
            {readOnlyField('Full Name', currentUser.displayName, UserRound)}
            {readOnlyField('Email Address', currentUser.email, Mail)}
            {readOnlyField('Username', currentUser.username, Fingerprint)}
            {readOnlyField('PERSAL Number', currentUser.persalNumber || '', Fingerprint)}
            {readOnlyField('Province', currentUser.province, MapPin)}
            {readOnlyField('Office', currentUser.office, Building2)}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Building2 size={13} /> Directorate
              <span className="profile-managed-tag">AD / HR managed</span>
            </label>
            <input type="text" className="form-input" value={currentUser.directorate || ''} disabled style={{ opacity: 0.75 }} />
          </div>

          <h4 className="profile-subsection-title">Editable details</h4>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Briefcase size={13} /> Designation / Job Title
              </label>
              <input
                type="text"
                className="form-input"
                value={jobTitle}
                maxLength={100}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Security Supervisor"
              />
              <span className="form-hint">Used on official forms (incident notifications, BTO and investigation reports).</span>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={13} /> Work Contact Number
              </label>
              <input
                type="text"
                className="form-input"
                value={phoneNumber}
                maxLength={25}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 012 312 8600"
              />
              <span className="form-hint">Shown as your contact detail on incident reports routed to coordinators.</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Save size={15} /> {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ===== Role & Access ===== */}
      {activeTab === 'role' && (
        <div className="profile-tab-panel">
          <h3 className="profile-section-title"><ShieldCheck size={16} /> Role & Access</h3>

          <div className="form-grid">
            <div className="profile-field">
              <span className="profile-field-label">System Role</span>
              <span className="profile-field-val">{currentUser.roleLabel} ({currentUser.roleCode})</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Data Scope</span>
              <span className="profile-field-val">{dataScope}</span>
            </div>
          </div>

          <h4 className="profile-subsection-title">Permissions ({permissions.length})</h4>
          <p className="profile-section-note">
            Access follows the need-to-know principle and role-based access control (FR-032). Provincial data is
            strictly segregated (FR-033) and every action is recorded in the immutable audit trail (FR-035).
          </p>
          <ul className="profile-permission-list">
            {permissions.map(p => (
              <li key={p}>
                <CheckCircle2 size={14} className="perm-icon" />
                <div>
                  <span className="perm-key">{p}</span>
                  <span className="perm-desc">{PERMISSION_DESCRIPTIONS[p]}</span>
                </div>
              </li>
            ))}
          </ul>

          <h4 className="profile-subsection-title">Screens you can access</h4>
          <div className="profile-screen-chips">
            {accessibleScreens.map(item => (
              <span key={item.view} className="profile-screen-chip">{getViewLabelForRole(item.view, currentUser.role)}</span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Security ===== */}
      {activeTab === 'security' && (
        <div className="profile-security-grid">
          <div className="profile-tab-panel">
            <h3 className="profile-section-title"><Shield size={16} /> Security Clearance & Vetting</h3>
            <div className="profile-clearance-card">
              <span className={`badge clearance-badge level-${currentUser.clearanceLevel.toLowerCase().replace(' ', '-')}`}>
                <Lock size={12} /> {currentUser.clearanceLevel}
              </span>
              <p>{CLEARANCE_DESCRIPTIONS[currentUser.clearanceLevel]}</p>
            </div>
            <p className="profile-section-note">
              Personnel clearance is issued through vetting by the State Security Agency (SSA) in terms of the Minimum
              Information Security Standards (MISS). Classified information is furnished strictly on a need-to-know
              basis. Contact CD: SFMS to query or renew your clearance.
            </p>

            <h4 className="profile-subsection-title">Password</h4>
            <div className="profile-clearance-card">
              <span className="badge role-badge"><KeyRound size={12} /> Managed by Azure Active Directory</span>
              <p>
                Your password cannot be changed in SIMS. The department authenticates via Active Directory
                Single Sign-On (FR-031), so your sign-in credential is your departmental AD account.
              </p>
            </div>
            <p className="profile-section-note">
              To change or reset your password, use the departmental Active Directory process (Ctrl+Alt+Del →
              Change a password on a departmental workstation) or contact the ICT/MTS service desk. The change
              applies to SIMS automatically at your next sign-in.
            </p>
          </div>

          <div className="profile-tab-panel">
            <h3 className="profile-section-title"><Clock size={16} /> Recent Account Activity</h3>
            <p className="profile-section-note">
              Your most recent actions from the system audit trail (FR-035). The trail is immutable and legally
              significant under PAJA; entries cannot be edited or deleted.
            </p>
            {activity.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {activityLoaded ? 'No recorded activity yet for this account.' : 'Loading activity…'}
              </p>
            ) : (
              <div className="profile-activity-list">
                {activity.map(entry => (
                  <div key={entry.id} className="profile-activity-item">
                    <span className={`profile-activity-action action-${entry.action.toLowerCase()}`}>{entry.action}</span>
                    <div className="profile-activity-body">
                      <span className="profile-activity-resource">{entry.resource}</span>
                      {entry.details && <span className="profile-activity-details">{entry.details}</span>}
                    </div>
                    <span className="profile-activity-time">{formatDateTime(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Preferences ===== */}
      {activeTab === 'preferences' && (
        <div className="profile-tab-panel">
          <h3 className="profile-section-title"><Bell size={16} /> Notification Preferences</h3>
          <p className="profile-section-note">
            SIMS delivers notifications by email and in-system alert (FR-008) within two minutes of the trigger
            (NFR-006). Mandatory statutory notifications — e.g. immediate NOC reporting of incidents — are always sent
            regardless of these settings.
          </p>

          {([
            { key: 'emailNotifications', label: 'Email notifications', desc: 'Incident routing, assignments, approvals and closure outcomes by email.' },
            { key: 'inAppNotifications', label: 'In-system alerts', desc: 'Bell-icon alerts inside the SIMS portal.' },
            { key: 'slaReminders', label: 'SLA reminders & escalation warnings', desc: 'Reminders before investigation deadlines (14-day report, 48h SSA breach reporting) and overdue escalations (FR-017/FR-018).' },
            { key: 'monthlyDigest', label: 'Monthly performance digest', desc: 'Summary of your province’s monthly performance statistics (Apr–Mar financial year).' }
          ] as { key: keyof UserPreferences; label: string; desc: string }[]).map(pref => (
            <label key={pref.key} className="profile-pref-row">
              <input
                type="checkbox"
                checked={preferences[pref.key]}
                onChange={(e) => setPreferences(prev => ({ ...prev, [pref.key]: e.target.checked }))}
              />
              <div>
                <span className="profile-pref-label">{pref.label}</span>
                <span className="profile-pref-desc">{pref.desc}</span>
              </div>
            </label>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleSavePreferences} disabled={savingPreferences} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Save size={15} /> {savingPreferences ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      <p className="profile-popia-note">
        <Lock size={12} /> Your personal information is processed in terms of the Protection of Personal Information
        Act (POPIA, Act 4 of 2013) and departmental information-security policy. Incident records are retained for a
        minimum of 10 years (archival 15).
      </p>
    </div>
  );
};

