import React, { useState } from 'react';
import type { ChecklistItem } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { getPermissionsForRole } from '../security/roleAccess';
import { Save, Settings2, Activity, UserPlus, RefreshCw, Mail, Smartphone, BellRing, ArrowLeft, KeyRound, Pencil, Power, ShieldCheck, MapPin, Phone, Hash, Briefcase, Building2, Clock, UserCog, Check, X, Camera, ImagePlus, Loader2 } from 'lucide-react';
import { PROVINCES } from '../data/mockData';
import { useModal } from './NotificationModal';
import { Pagination } from './Pagination';

interface AdministrationViewProps {
  checklists: ChecklistItem[];
  onUpdateChecklist: (updatedChecklist: ChecklistItem[]) => void;
  currentUser: UserProfile;
}

type AdminUser = UserProfile & { isActive?: boolean };

interface RoleOption {
  role: string;
  roleCode: string;
  label: string;
}

interface SlaRulesDraft {
  classificationTargets: Record<string, string>;
  defaultTargetHours: string;
  atRiskThresholdPercent: string;
  fullReportDays: string;
  breachToSsaHours: string;
  investigationWorkingDays: string;
}

interface TemplateDraft {
  title: string;
  message: string;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  username: string;
  userRole: string;
  action: string;
  resource: string;
  details?: string;
}

const PROVINCE_OPTIONS = [...PROVINCES, 'National'];
const CLEARANCE_OPTIONS = ['Public', 'Restricted', 'Confidential', 'Secret', 'Top Secret'];

const EMPTY_NEW_USER = {
  username: '',
  displayName: '',
  email: '',
  role: 'employee',
  province: 'Gauteng',
  office: '',
  clearanceLevel: 'Restricted',
  persalNumber: '',
  jobTitle: '',
  phoneNumber: ''
};

const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
};

// Plain-language summary of each system role, shown on the Role Overview card.
const ROLE_DESCRIPTIONS: Record<string, string> = {
  employee: 'Front-line staff member who reports security incidents and tracks their own submissions.',
  security_coordinator: 'Provincial owner of incidents — triages, updates, approves and closes cases within their own province.',
  chief_security_investigator: 'Conducts assigned investigations and submits investigation reports to the review chain.',
  deputy_director: 'National verification layer — reviews and recommends before the Chief Security Director signs off.',
  security_director: 'National authority — approves cases, assigns investigators and manages roles and leave allocation.',
  system_administrator: 'ICT / MTS — manages users, roles, SLA rules, notification templates and escalation configuration.'
};

// Data-visibility scope for each role, surfaced alongside the permission chips.
const ROLE_DATA_SCOPE: Record<string, string> = {
  employee: 'Own submissions only',
  security_coordinator: 'Assigned province',
  chief_security_investigator: 'Assigned cases (national)',
  deputy_director: 'All provinces (national)',
  security_director: 'All provinces (national)',
  system_administrator: 'All provinces (national)'
};

// 'incident:create' -> 'Incident · Create'
const formatPermission = (permission: string) => {
  const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const [group, action] = permission.split(':');
  return action ? `${humanize(group)} · ${humanize(action)}` : humanize(group);
};

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// Profile-photo upload limits — kept in step with the server (fileStorage.service.ts).
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/heic'];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

export const AdministrationView: React.FC<AdministrationViewProps> = ({ checklists, onUpdateChecklist, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'sla' | 'users' | 'roles' | 'categories' | 'notifications' | 'system_logs' | 'checklist' | 'staff'>('sla');
  const [localChecklists, setLocalChecklists] = useState<ChecklistItem[]>(checklists);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [leaveDrafts, setLeaveDrafts] = useState<Record<string, string>>({});
  const { showAlert, showConfirm } = useModal();

  // User management (create/modify/deactivate)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: '', email: '', role: '', province: '', office: '', clearanceLevel: '', jobTitle: '', phoneNumber: '', persalNumber: '' });
  const [userSearchTerm, setUserSearchTerm] = useState('');
  // Full-page user profile: which account is open, and whether its details are in edit mode.
  const [viewingUsername, setViewingUsername] = useState<string | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  // Profile photo of the account currently open in the profile view. objectUrl is the
  // fetched stored photo; localPreview is the just-picked image shown instantly on upload.
  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const [viewAvatarObjectUrl, setViewAvatarObjectUrl] = useState<string | null>(null);
  const [viewAvatarPreview, setViewAvatarPreview] = useState<string | null>(null);
  const [viewAvatarUploading, setViewAvatarUploading] = useState(false);

  // System configuration
  const [configLoaded, setConfigLoaded] = useState(false);
  const [slaDraft, setSlaDraft] = useState<SlaRulesDraft | null>(null);
  const [escalationLevelsDraft, setEscalationLevelsDraft] = useState('');
  const [categoriesDraft, setCategoriesDraft] = useState('');
  const [templatesDraft, setTemplatesDraft] = useState<Record<string, TemplateDraft>>({});

  // Notifications templates selection state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('coordinator_triage_alert');
  const [selectedTemplateChannel, setSelectedTemplateChannel] = useState<'email' | 'sms' | 'in_app'>('email');

  // System health & logs
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  // System Logs use server-side pagination (the audit trail can grow unbounded).
  const [logSearchDebounced, setLogSearchDebounced] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const LOGS_PER_PAGE = 10;
  // User Management uses client-side pagination (the account list is small/bounded).
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;

  // Role Permissions Matrix State (matching Roles.png mockup)
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, Record<string, boolean>>>({
    'VIEW INCIDENTS': {
      'Employee': true,
      'Security Coordinator': true,
      'Security Investigator': true,
      'Chief Director': true,
      'Administrator': true
    },
    'CREATE INCIDENTS': {
      'Employee': true,
      'Security Coordinator': true,
      'Security Investigator': false,
      'Chief Director': true,
      'Administrator': true
    },
    'APPROVE CASES': {
      'Employee': false,
      'Security Coordinator': true,
      'Security Investigator': false,
      'Chief Director': true,
      'Administrator': true
    },
    'CONFIGURE SYSTEM': {
      'Employee': false,
      'Security Coordinator': false,
      'Security Investigator': false,
      'Chief Director': false,
      'Administrator': true
    }
  });

  const getTabStyle = (tab: typeof activeTab) => {
    const isActive = activeTab === tab;
    return {
      borderRadius: 'var(--radius-sm)',
      padding: '0.5rem 1.25rem',
      fontSize: '0.85rem',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      border: 'none',
      background: isActive
        ? 'linear-gradient(90deg, var(--color-primary), var(--color-primary-hover))'
        : 'rgba(0, 0, 0, 0.04)',
      color: isActive ? '#ffffff' : 'var(--text-secondary)',
      boxShadow: isActive ? '0 6px 16px rgba(116, 71, 39, 0.35)' : 'none',
    };
  };

  const permissions = getPermissionsForRole(currentUser.role);
  const canManageLeaveAllocation = permissions.includes('leave:manage_allocation');
  const canManageSystemConfig = permissions.includes('admin:system_config');

  React.useEffect(() => {
    setLocalChecklists(checklists);
  }, [checklists]);

  const authHeaders = {
    'x-username': currentUser.username,
    'x-user-role': currentUser.role
  };
  const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

  const loadUsers = React.useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users?includeInactive=1', { headers: authHeaders });
      const json = await res.json();
      if (json.success) setUsers(json.data);
      const rolesRes = await fetch('/api/roles', { headers: authHeaders });
      const rolesJson = await rolesRes.json();
      if (rolesJson.success) setRoleOptions(rolesJson.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [currentUser.username]);

  const loadConfig = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config', { headers: authHeaders });
      const json = await res.json();
      if (!json.success) return;
      const { config } = json.data;
      setSlaDraft({
        classificationTargets: Object.fromEntries(
          Object.entries(config.sla_rules.classificationTargets).map(([k, v]) => [k, String(v)])
        ),
        defaultTargetHours: String(config.sla_rules.defaultTargetHours),
        atRiskThresholdPercent: String(config.sla_rules.atRiskThresholdPercent),
        fullReportDays: String(config.sla_rules.fullReportDays),
        breachToSsaHours: String(config.sla_rules.breachToSsaHours),
        investigationWorkingDays: String(config.sla_rules.investigationWorkingDays)
      });
      setEscalationLevelsDraft(config.escalation_rules.levels.join('\n'));
      setCategoriesDraft(config.incident_categories.incidentTypes.join('\n'));
      setTemplatesDraft(config.notification_templates);
      setConfigLoaded(true);
    } catch (err) {
      console.error('Failed to load system configuration:', err);
    }
  }, [currentUser.username]);

  const loadHealth = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-health', { headers: authHeaders });
      const healthJson = await res.json();
      if (healthJson.success) setHealth(healthJson.data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    }
  }, [currentUser.username]);

  // Server-side paginated audit-log fetch (page + keyword search handled by the API).
  const loadLogs = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(logPage), pageSize: String(LOGS_PER_PAGE) });
      if (logSearchDebounced.trim()) params.set('search', logSearchDebounced.trim());
      const res = await fetch(`/api/audit-logs?${params.toString()}`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        setAuditLogs(json.data);
        setLogTotal(json.pagination?.total ?? json.data.length);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }, [currentUser.username, logPage, logSearchDebounced]);

  // Debounce the log keyword box so each keystroke doesn't hit the server.
  React.useEffect(() => {
    const t = setTimeout(() => setLogSearchDebounced(logSearchTerm), 300);
    return () => clearTimeout(t);
  }, [logSearchTerm]);

  // A new search resets to the first page of results.
  React.useEffect(() => {
    setLogPage(1);
  }, [logSearchDebounced]);

  React.useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'sla' || activeTab === 'categories' || activeTab === 'notifications') {
      if (!configLoaded) loadConfig();
    }
    if (activeTab === 'system_logs') {
      loadHealth();
      loadLogs();
    }
  }, [activeTab, loadUsers, loadConfig, loadHealth, loadLogs, configLoaded]);

  const saveConfig = async (key: string, value: object, successMessage: string) => {
    try {
      const res = await fetch(`/api/admin/config/${key}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ value })
      });
      const json = await res.json();
      if (json.success) {
        showAlert(`${successMessage} The change applies immediately and was recorded in the audit trail.`, 'Configuration Saved', 'success');
      } else {
        showAlert(json.error || json.message || 'Save failed.', 'Validation Failed', 'warning');
      }
    } catch {
      showAlert('Save failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const handleSaveSlaRules = () => {
    if (!slaDraft) return;
    const targets: Record<string, number> = {};
    for (const [classification, raw] of Object.entries(slaDraft.classificationTargets)) {
      targets[classification] = Number(raw);
    }
    saveConfig('sla_rules', {
      classificationTargets: targets,
      defaultTargetHours: Number(slaDraft.defaultTargetHours),
      atRiskThresholdPercent: Number(slaDraft.atRiskThresholdPercent),
      fullReportDays: Number(slaDraft.fullReportDays),
      breachToSsaHours: Number(slaDraft.breachToSsaHours),
      investigationWorkingDays: Number(slaDraft.investigationWorkingDays)
    }, 'SLA rules updated.');
  };

  const handleSaveEscalation = () => {
    const levels = escalationLevelsDraft.split('\n').map(l => l.trim()).filter(Boolean);
    saveConfig('escalation_rules', { levels, notifyRole: 'security_director' }, 'Escalation matrix updated.');
  };

  const handleSaveCategories = () => {
    const incidentTypes = categoriesDraft.split('\n').map(l => l.trim()).filter(Boolean);
    saveConfig('incident_categories', { incidentTypes }, 'Incident categories updated.');
  };

  const handleSaveTemplates = () => {
    saveConfig('notification_templates', templatesDraft, 'Notification templates updated.');
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(newUser)
      });
      const json = await res.json();
      if (json.success) {
        showAlert(`Account '${newUser.username}' was created and recorded in the audit trail.`, 'User Created', 'success');
        setNewUser({ ...EMPTY_NEW_USER });
        setShowAddUser(false);
        loadUsers();
      } else {
        showAlert(json.error || json.message || 'Creation failed.', 'Validation Failed', 'warning');
      }
    } catch {
      showAlert('Creation failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const openProfile = (user: AdminUser) => {
    setViewingUsername(user.username);
    setProfileEditMode(false);
    setViewAvatarPreview(null);
  };

  const closeProfile = () => {
    setViewingUsername(null);
    setProfileEditMode(false);
    setEditingUsername(null);
    setViewAvatarPreview(null);
  };

  const handlePickUserPhoto = () => avatarFileInputRef.current?.click();

  const handleUserAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !viewingUsername) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showAlert('Please choose an image file (PNG, JPG, GIF, WEBP, BMP or HEIC).', 'Unsupported File', 'warning');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showAlert('Profile photos must be 5 MB or smaller. Please choose a smaller image.', 'Image Too Large', 'warning');
      return;
    }

    setViewAvatarUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`/api/users/${encodeURIComponent(viewingUsername)}/avatar`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: dataUrl }),
      });
      const json = await res.json();
      if (json.success) {
        // Show the just-picked image immediately; the user list refresh brings the
        // new stored path so the effect re-fetches and every avatar stays in step.
        setViewAvatarPreview(dataUrl);
        loadUsers();
        showAlert(`Profile photo for '${viewingUsername}' has been updated.`, 'Photo Updated', 'success');
      } else {
        showAlert(json.message || json.error || 'Failed to update profile photo.', 'Upload Failed', 'danger');
      }
    } catch {
      showAlert('Could not upload the image. Please try again.', 'Upload Failed', 'danger');
    } finally {
      setViewAvatarUploading(false);
    }
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUsername(user.username);
    setEditDraft({
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      province: user.province,
      office: user.office,
      clearanceLevel: user.clearanceLevel,
      jobTitle: user.jobTitle || '',
      phoneNumber: user.phoneNumber || '',
      persalNumber: user.persalNumber || ''
    });
    setProfileEditMode(true);
  };

  const cancelEditUser = () => {
    setProfileEditMode(false);
    setEditingUsername(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUsername) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editingUsername)}/details`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(editDraft)
      });
      const json = await res.json();
      if (json.success) {
        showAlert(`Account '${editingUsername}' was updated and recorded in the audit trail.`, 'User Updated', 'success');
        setProfileEditMode(false);
        setEditingUsername(null);
        loadUsers();
      } else {
        showAlert(json.error || json.message || 'Update failed.', 'Validation Failed', 'warning');
      }
    } catch {
      showAlert('Update failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const handleToggleActive = (user: AdminUser) => {
    const deactivating = user.isActive !== false;
    showConfirm({
      title: deactivating ? 'Deactivate Account' : 'Reactivate Account',
      message: deactivating
        ? `Deactivate '${user.displayName}'? They will no longer be able to sign in; their records and audit history are preserved.`
        : `Reactivate '${user.displayName}'? They will be able to sign in again with their existing role.`,
      confirmText: deactivating ? 'Yes, Deactivate' : 'Yes, Reactivate',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/active`, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify({ isActive: !deactivating })
          });
          const json = await res.json();
          if (json.success) {
            showAlert(`Account '${user.username}' is now ${deactivating ? 'deactivated' : 'active'}.`, 'Account Status Changed', 'success');
            loadUsers();
          } else {
            showAlert(json.error || json.message || 'Status change failed.', 'Operation Failed', 'warning');
          }
        } catch {
          showAlert('Status change failed — server unreachable.', 'Operation Failed', 'warning');
        }
      }
    });
  };

  const handleAssignTemp = async (user: UserProfile) => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/temp-coordinator`, {
        method: 'POST',
        headers: authHeaders
      });
      const json = await res.json();
      if (json.success) {
        showAlert(
          `${user.displayName} is now a Temporary Security Coordinator for ${user.province}, with the full rights of a permanent coordinator.`,
          'Temporary Assignment Made',
          'success'
        );
        loadUsers();
      } else {
        showAlert(json.message || 'Assignment failed.', 'Operation Failed', 'warning');
      }
    } catch {
      showAlert('Assignment failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const handleSaveLeaveAllocation = async (user: UserProfile) => {
    const draft = leaveDrafts[user.username];
    const totalLeaves = Number(draft);
    if (draft === undefined || draft === '' || !Number.isInteger(totalLeaves) || totalLeaves < 0 || totalLeaves > 365) {
      showAlert('Enter a whole number of leave days between 0 and 365.', 'Invalid Allocation', 'warning');
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/leave-allocation`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ totalLeaves })
      });
      const json = await res.json();
      if (json.success) {
        showAlert(`${user.displayName}'s leave day allocation updated to ${totalLeaves} days.`, 'Leave Days Saved', 'success');
        setLeaveDrafts(prev => {
          const next = { ...prev };
          delete next[user.username];
          return next;
        });
        loadUsers();
      } else {
        showAlert(json.message || 'Save failed.', 'Operation Failed', 'warning');
      }
    } catch {
      showAlert('Save failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const handleSaveChecklist = () => {
    onUpdateChecklist(localChecklists);
    showAlert('Safety checklist items have been saved successfully.', 'Checklist Saved', 'success');
  };

  const handleResetPassword = (email: string) => {
    showAlert(`Password reset instructions have been dispatched to ${email}.`, 'Password Link Dispatched', 'success');
  };

  const handleSyncAD = () => {
    showAlert('Successfully synchronized user identities with Microsoft Entra ID (Active Directory). 15 user profiles updated.', 'Active Directory Synced', 'success');
  };

  const handleSaveMatrix = () => {
    showAlert('Role permission matrix mappings updated and persisted in local directory scopes.', 'Matrix Mappings Saved', 'success');
  };

  const handleInsertVariable = (variable: string) => {
    if (!templatesDraft[selectedTemplateKey]) return;
    setTemplatesDraft(prev => ({
      ...prev,
      [selectedTemplateKey]: {
        ...prev[selectedTemplateKey],
        message: (prev[selectedTemplateKey].message || '') + ' ' + variable
      }
    }));
  };

  const securityPersonnel = [
    { name: 'Sarah van Wyk', role: 'Security Coordinator', clearance: 'Secret', status: 'Cleared', date: '2028-11-14' },
    { name: 'Sipho Dlamini', role: 'Security Coordinator', clearance: 'Confidential', status: 'Cleared', date: '2027-04-09' },
    { name: 'Jacob Modise', role: 'Chief Security Investigator', clearance: 'Top Secret', status: 'Cleared', date: '2029-01-30' },
    { name: 'Palesa Nkosi', role: 'Deputy Director: Physical Security', clearance: 'Secret', status: 'In Progress', date: 'Pending' },
    { name: 'Johan Bezuidenhout', role: 'Acting Coordinator (Leave Cover)', clearance: 'Public', status: 'Rejected', date: 'Expired' }
  ];

  const filteredUsers = users.filter(user => {
    const term = userSearchTerm.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.roleLabel.toLowerCase().includes(term) ||
      user.province.toLowerCase().includes(term)
    );
  });

  // The account currently open in the full-page profile view (kept in sync with the live user list).
  const viewingUser = viewingUsername ? users.find(u => u.username === viewingUsername) || null : null;

  // Close the profile view automatically if its account disappears from the list (e.g. after a filter/sync).
  React.useEffect(() => {
    if (viewingUsername && !usersLoading && !users.some(u => u.username === viewingUsername)) {
      closeProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingUsername, users, usersLoading]);

  // Fetch the open account's stored profile photo whenever it (or its stored path) changes.
  React.useEffect(() => {
    if (!viewingUsername || !viewingUser?.avatarUrl) {
      setViewAvatarObjectUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(viewingUsername)}/avatar`, { headers: authHeaders });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setViewAvatarObjectUrl(objectUrl);
      } catch {
        /* keep the initials fallback */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingUsername, viewingUser?.avatarUrl]);

  // Once the stored photo reflects a new upload, drop the local preview override.
  React.useEffect(() => {
    if (viewAvatarObjectUrl) setViewAvatarPreview(null);
  }, [viewAvatarObjectUrl]);

  // Audit logs are already filtered + paged by the server; render them directly.

  // Client-side user pagination resets to page one when the user search changes.
  React.useEffect(() => {
    setUserPage(1);
  }, [userSearchTerm]);

  const smallInput = { padding: '0.35rem 0.5rem', fontSize: '0.8rem' };
  const fieldLabel = { fontSize: '0.72rem', fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'block' };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Administration Hub</h1>
          <p className="page-subtitle">System configuration, users, roles and audit trail.</p>
        </div>
      </div>

      {/* Modern tab selectors matching active layout and color schemes */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {([
          { id: 'sla', label: 'SLA' },
          { id: 'users', label: 'Users' },
          { id: 'roles', label: 'Roles' },
          { id: 'categories', label: 'Categories' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'system_logs', label: 'System Logs' },
          { id: 'checklist', label: 'Checklists' },
          { id: 'staff', label: 'Vetting' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={getTabStyle(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SLA TAB */}
      {activeTab === 'sla' && canManageSystemConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings2 size={20} color="var(--color-primary)" />
              Response Times (hours)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Resolution targets per classification drive the On Track / At Risk / Overdue indicators on the SLA monitor.
            </p>
            {!slaDraft ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading configuration…</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={fieldLabel}>Urgent (Top Secret)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={smallInput}
                      value={slaDraft.classificationTargets['Top Secret'] || '2'}
                      onChange={e => setSlaDraft({
                        ...slaDraft,
                        classificationTargets: { ...slaDraft.classificationTargets, 'Top Secret': e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>High (Secret)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={smallInput}
                      value={slaDraft.classificationTargets['Secret'] || '6'}
                      onChange={e => setSlaDraft({
                        ...slaDraft,
                        classificationTargets: { ...slaDraft.classificationTargets, 'Secret': e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Medium (Confidential)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={smallInput}
                      value={slaDraft.classificationTargets['Confidential'] || '12'}
                      onChange={e => setSlaDraft({
                        ...slaDraft,
                        classificationTargets: { ...slaDraft.classificationTargets, 'Confidential': e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Low (Unclassified)</label>
                    <input
                      type="number"
                      className="form-input"
                      style={smallInput}
                      value={slaDraft.classificationTargets['Unclassified'] || '24'}
                      onChange={e => setSlaDraft({
                        ...slaDraft,
                        classificationTargets: { ...slaDraft.classificationTargets, 'Unclassified': e.target.value }
                      })}
                    />
                  </div>
                </div>
                <button className="btn btn-success" style={{ padding: '0.4rem 1.25rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveSlaRules}>
                  <Save size={14} /> Save SLA Rules
                </button>
              </>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Escalation Matrix</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Permitted escalation levels, one per line, in ascending order of severity.
            </p>
            <textarea
              className="form-input"
              style={{ ...smallInput, minHeight: '110px', fontFamily: 'inherit' }}
              value={escalationLevelsDraft}
              onChange={e => setEscalationLevelsDraft(e.target.value)}
            />
            <button className="btn btn-success" style={{ marginTop: '0.75rem', padding: '0.4rem 1.25rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveEscalation}>
              <Save size={14} /> Save Escalation Matrix
            </button>
          </div>
        </div>
      )}

      {/* USERS TAB — account list (hidden while a profile is open) */}
      {activeTab === 'users' && !viewingUsername && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Active Directory Users</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Synchronize, edit, reset passwords and assign roles to system accounts.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleSyncAD} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <RefreshCw size={14} /> Sync with AD
              </button>
              <button className="btn btn-success" onClick={() => setShowAddUser(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserPlus size={14} /> Add User
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search by name, email, role, or province..."
              className="form-input"
              style={{ maxWidth: '360px', fontSize: '0.85rem' }}
              value={userSearchTerm}
              onChange={e => setUserSearchTerm(e.target.value)}
            />
          </div>

          {/* Add User overlay form */}
          {showAddUser && (
            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0' }}>Create New Account</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={fieldLabel}>Username / PERSAL</label>
                  <input type="text" className="form-input" style={smallInput} value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Display Name</label>
                  <input type="text" className="form-input" style={smallInput} value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Email Address</label>
                  <input type="email" className="form-input" style={smallInput} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>System Role</label>
                  <select className="form-input" style={smallInput} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    {roleOptions.map(opt => (
                      <option key={opt.role} value={opt.role}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Province</label>
                  <select className="form-input" style={smallInput} value={newUser.province} onChange={e => setNewUser({ ...newUser, province: e.target.value })}>
                    {PROVINCE_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Clearance Level</label>
                  <select className="form-input" style={smallInput} value={newUser.clearanceLevel} onChange={e => setNewUser({ ...newUser, clearanceLevel: e.target.value as any })}>
                    {CLEARANCE_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={() => setShowAddUser(false)}>Cancel</button>
                <button className="btn btn-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={handleCreateUser}>Create User</button>
              </div>
            </div>
          )}

          {usersLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading users…</p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th>PROVINCE</th>
                    <th>STATUS</th>
                    {canManageLeaveAllocation && <th>LEAVE BALANCE</th>}
                    <th style={{ textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE).map(user => (
                    <tr key={user.id} style={user.isActive === false ? { opacity: 0.55 } : undefined}>
                      <td style={{ fontWeight: 600 }}>{user.displayName}</td>
                      <td>{user.email || '—'}</td>
                      <td><span className="badge primary">{user.roleLabel}</span></td>
                      <td>{user.province}</td>
                      <td>
                        {user.isActive === false ? (
                          <span className="badge danger">Deactivated</span>
                        ) : user.baseRole ? (
                          <span className="badge warning">Acting</span>
                        ) : (
                          <span className="badge success">Active</span>
                        )}
                      </td>
                      {canManageLeaveAllocation && (
                        <td>
                          {user.isActive !== false && user.role === 'security_coordinator' && !user.baseRole ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <input
                                type="number"
                                className="form-input"
                                min={0}
                                max={365}
                                value={leaveDrafts[user.username] ?? String(user.totalLeaves ?? 0)}
                                onChange={(e) => setLeaveDrafts(prev => ({ ...prev, [user.username]: e.target.value }))}
                                style={{ width: '56px', padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                              />
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                                disabled={leaveDrafts[user.username] === undefined || leaveDrafts[user.username] === String(user.totalLeaves ?? 0)}
                                onClick={() => handleSaveLeaveAllocation(user)}
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.totalLeaves ?? '—'}</span>
                          )}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.85rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          onClick={() => openProfile(user)}
                        >
                          <UserCog size={13} /> View More
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={userPage}
                totalItems={filteredUsers.length}
                itemsPerPage={USERS_PER_PAGE}
                onPageChange={setUserPage}
              />
            </div>
          )}
        </div>
      )}

      {/* USERS TAB — full-page account profile */}
      {activeTab === 'users' && viewingUser && (() => {
        const u = viewingUser;
        const isInactive = u.isActive === false;
        const isActing = !!u.baseRole;
        const rolePermissions = getPermissionsForRole(u.role);
        const roleDescription = ROLE_DESCRIPTIONS[u.role] || 'System role.';
        const dataScope = ROLE_DATA_SCOPE[u.role] || u.province;
        const statusBadge = isInactive
          ? { label: 'Deactivated', cls: 'danger' }
          : isActing
            ? { label: 'Acting Assignment', cls: 'warning' }
            : { label: 'Active', cls: 'success' };

        const detailRows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
          { icon: <Hash size={15} />, label: 'Username / PERSAL', value: u.username },
          { icon: <Mail size={15} />, label: 'Email Address', value: u.email || '—' },
          { icon: <ShieldCheck size={15} />, label: 'System Role', value: u.roleLabel },
          { icon: <MapPin size={15} />, label: 'Province', value: u.province },
          { icon: <Building2 size={15} />, label: 'Office', value: u.office || '—' },
          { icon: <ShieldCheck size={15} />, label: 'Clearance Level', value: u.clearanceLevel || '—' },
          { icon: <Briefcase size={15} />, label: 'Job Title', value: u.jobTitle || '—' },
          { icon: <Phone size={15} />, label: 'Phone Number', value: u.phoneNumber || '—' },
          { icon: <Hash size={15} />, label: 'PERSAL Number', value: u.persalNumber || '—' },
          { icon: <Clock size={15} />, label: 'Last Login', value: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never' }
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button
              className="btn btn-secondary"
              onClick={closeProfile}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
            >
              <ArrowLeft size={15} /> Back to Users
            </button>

            {/* Identity header */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: '80px', background: 'linear-gradient(120deg, var(--color-primary), var(--color-primary-hover))' }} />
              <div style={{ padding: '0 1.75rem 1.5rem' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '92px', height: '92px', flexShrink: 0, marginTop: '-46px',
                    opacity: isInactive ? 0.6 : 1
                  }}
                >
                  {/* Circular face: photo when set, otherwise initials. Clipped on its
                      own so the edit badge below isn't cut off by the round mask. */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                      background: 'var(--bg-subtle)', border: '4px solid var(--card-bg, #fff)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.9rem', fontWeight: 700, color: 'var(--color-primary)',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
                    }}
                  >
                    {viewAvatarPreview || viewAvatarObjectUrl ? (
                      <img
                        src={viewAvatarPreview || viewAvatarObjectUrl || ''}
                        alt={`${u.displayName} profile photo`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      initialsOf(u.displayName)
                    )}

                    {viewAvatarUploading && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.45)', color: '#fff'
                      }}>
                        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                  </div>

                  {/* Admin can add/replace this account's photo. Add (image) icon when
                      there's none yet; Camera once a photo exists. */}
                  <button
                    type="button"
                    onClick={handlePickUserPhoto}
                    disabled={viewAvatarUploading}
                    title={viewAvatarPreview || viewAvatarObjectUrl ? 'Change profile photo' : 'Add profile photo'}
                    aria-label={viewAvatarPreview || viewAvatarObjectUrl ? 'Change profile photo' : 'Add profile photo'}
                    style={{
                      position: 'absolute', bottom: '2px', right: '2px',
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: '2px solid var(--card-bg, #fff)', background: 'var(--color-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: viewAvatarUploading ? 'default' : 'pointer', padding: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                    }}
                  >
                    {viewAvatarPreview || viewAvatarObjectUrl ? <Camera size={14} /> : <ImagePlus size={14} />}
                  </button>

                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/heic"
                    style={{ display: 'none' }}
                    onChange={handleUserAvatarSelected}
                  />
                </div>
                <div style={{ marginTop: '0.85rem' }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', lineHeight: 1.2 }}>{u.displayName}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                    <span className="badge primary">{u.roleLabel}</span>
                    <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <MapPin size={13} /> {u.province}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Mail size={13} /> {u.email || '—'}
                    </span>
                  </div>
                </div>

                {/* Account actions (hidden while editing) */}
                {!profileEditMode && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                      onClick={() => handleResetPassword(u.email || 'user@dlrrd.gov.za')}
                    >
                      <KeyRound size={15} /> Reset Password
                    </button>
                    {u.role === 'employee' && !isInactive && (
                      <button
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                        onClick={() => handleAssignTemp(u)}
                      >
                        <UserCog size={15} /> Make Acting
                      </button>
                    )}
                    <button
                      className={`btn ${isInactive ? 'btn-success' : 'btn-secondary'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isInactive ? '#052E22' : 'var(--color-danger)' }}
                      onClick={() => handleToggleActive(u)}
                    >
                      <Power size={15} /> {isInactive ? 'Activate Account' : 'Deactivate Account'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Account details (read-only / editable) */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>Account Details</h3>
                {!profileEditMode ? (
                  <button
                    className="btn btn-success"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                    onClick={() => startEditUser(u)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                      onClick={cancelEditUser}
                    >
                      <X size={14} /> Cancel
                    </button>
                    <button
                      className="btn btn-success"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                      onClick={handleSaveEdit}
                    >
                      <Check size={14} /> Save Changes
                    </button>
                  </div>
                )}
              </div>

              {profileEditMode ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={fieldLabel}>Display Name</label>
                    <input type="text" className="form-input" style={smallInput} value={editDraft.displayName} onChange={e => setEditDraft({ ...editDraft, displayName: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Email Address</label>
                    <input type="email" className="form-input" style={smallInput} value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>System Role</label>
                    <select className="form-input" style={smallInput} value={editDraft.role} onChange={e => setEditDraft({ ...editDraft, role: e.target.value })} disabled={isActing}>
                      {roleOptions.map(opt => (
                        <option key={opt.role} value={opt.role}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Province</label>
                    <select className="form-input" style={smallInput} value={editDraft.province} onChange={e => setEditDraft({ ...editDraft, province: e.target.value })}>
                      {PROVINCE_OPTIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Office</label>
                    <input type="text" className="form-input" style={smallInput} value={editDraft.office} onChange={e => setEditDraft({ ...editDraft, office: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Clearance Level</label>
                    <select className="form-input" style={smallInput} value={editDraft.clearanceLevel} onChange={e => setEditDraft({ ...editDraft, clearanceLevel: e.target.value })}>
                      {CLEARANCE_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Job Title</label>
                    <input type="text" className="form-input" style={smallInput} value={editDraft.jobTitle} onChange={e => setEditDraft({ ...editDraft, jobTitle: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Phone Number</label>
                    <input type="text" className="form-input" style={smallInput} value={editDraft.phoneNumber} onChange={e => setEditDraft({ ...editDraft, phoneNumber: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>PERSAL Number</label>
                    <input type="text" className="form-input" style={smallInput} value={editDraft.persalNumber} onChange={e => setEditDraft({ ...editDraft, persalNumber: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
                  {detailRows.map(row => (
                    <div key={row.label} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.65rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--color-primary)', marginTop: '0.1rem', flexShrink: 0 }}>{row.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, wordBreak: 'break-word' }}>{row.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role overview */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Role Overview</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{u.roleLabel} · {u.roleCode}</p>
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 1.1rem 0' }}>{roleDescription}</p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ flex: '1 1 160px', padding: '0.85rem 1rem', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', fontWeight: 600 }}>Data Scope</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.15rem' }}>{dataScope}</div>
                </div>
                <div style={{ flex: '1 1 160px', padding: '0.85rem 1rem', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', fontWeight: 600 }}>Permissions</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.15rem' }}>{rolePermissions.length} granted</div>
                </div>
                {isActing && u.baseRole && (
                  <div style={{ flex: '1 1 160px', padding: '0.85rem 1rem', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', fontWeight: 600 }}>Permanent Role</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.15rem' }}>{ROLE_DESCRIPTIONS[u.baseRole] ? u.baseRole.replace(/_/g, ' ') : u.baseRole}</div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.6rem' }}>
                Access Permissions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {rolePermissions.map(perm => (
                  <span
                    key={perm}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.35rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                      background: 'rgba(116, 71, 39, 0.08)', color: 'var(--color-primary)', border: '1px solid rgba(116, 71, 39, 0.18)'
                    }}
                  >
                    <Check size={12} /> {formatPermission(perm)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ROLES TAB - MATRIX MAPPING */}
      {activeTab === 'roles' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Role Permission Matrix</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Manage role access permissions for incident tracking and system controls.
              </p>
            </div>
            <button className="btn btn-success" onClick={handleSaveMatrix} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Save size={14} /> Save Matrix
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table text-center">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>PERMISSION</th>
                  <th>EMPLOYEE</th>
                  <th>SECURITY COORDINATOR</th>
                  <th>SECURITY INVESTIGATOR</th>
                  <th>CHIEF DIRECTOR</th>
                  <th>ADMINISTRATOR</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(permissionMatrix).map(permission => (
                  <tr key={permission}>
                    <td style={{ textAlign: 'left', fontWeight: 600 }}>{permission}</td>
                    {['Employee', 'Security Coordinator', 'Security Investigator', 'Chief Director', 'Administrator'].map(role => (
                      <td key={role}>
                        <input
                          type="checkbox"
                          checked={permissionMatrix[permission][role] || false}
                          onChange={e => {
                            const val = e.target.checked;
                            setPermissionMatrix(prev => ({
                              ...prev,
                              [permission]: { ...prev[permission], [role]: val }
                            }));
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && canManageSystemConfig && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Incident Categories</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Incident types offered on the incident notification form, one per line.
          </p>
          <textarea
            className="form-input"
            style={{ ...smallInput, minHeight: '240px', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: '1.4' }}
            value={categoriesDraft}
            onChange={e => setCategoriesDraft(e.target.value)}
          />
          <button className="btn btn-success" style={{ marginTop: '0.75rem', padding: '0.4rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveCategories}>
            <Save size={14} /> Save Incident Categories
          </button>
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && canManageSystemConfig && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Notification Templates</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Configure email, SMS, and in-app system alert templates.
              </p>
            </div>
            <button className="btn btn-success" onClick={handleSaveTemplates} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Save size={14} /> Save Templates
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flexGrow: 1, minWidth: '240px' }}>
              <label style={fieldLabel}>Select Event Trigger Template</label>
              <select
                className="form-input"
                style={{ marginBottom: '1rem' }}
                value={selectedTemplateKey}
                onChange={e => setSelectedTemplateKey(e.target.value)}
              >
                {Object.keys(templatesDraft).map(key => (
                  <option key={key} value={key}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                <button
                  className={`btn ${selectedTemplateChannel === 'email' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setSelectedTemplateChannel('email')}
                >
                  <Mail size={12} /> Email
                </button>
                <button
                  className={`btn ${selectedTemplateChannel === 'sms' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setSelectedTemplateChannel('sms')}
                >
                  <Smartphone size={12} /> SMS
                </button>
                <button
                  className={`btn ${selectedTemplateChannel === 'in_app' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setSelectedTemplateChannel('in_app')}
                >
                  <BellRing size={12} /> In-App
                </button>
              </div>

              {templatesDraft[selectedTemplateKey] ? (
                <div>
                  {selectedTemplateChannel === 'email' && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={fieldLabel}>Subject Line</label>
                      <input
                        className="form-input"
                        style={smallInput}
                        value={templatesDraft[selectedTemplateKey].title || ''}
                        onChange={e => setTemplatesDraft({
                          ...templatesDraft,
                          [selectedTemplateKey]: { ...templatesDraft[selectedTemplateKey], title: e.target.value }
                        })}
                      />
                    </div>
                  )}
                  <div>
                    <label style={fieldLabel}>Message Template Body</label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '140px', fontFamily: 'inherit', fontSize: '0.85rem' }}
                      value={templatesDraft[selectedTemplateKey].message || ''}
                      onChange={e => setTemplatesDraft({
                        ...templatesDraft,
                        [selectedTemplateKey]: { ...templatesDraft[selectedTemplateKey], message: e.target.value }
                      })}
                    />
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>Select a template event from above.</p>
              )}
            </div>

            {/* Clickable Merge Variables Panel */}
            <div style={{ width: '220px', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Merge Variables</h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Click a pill below to append it to the template message body.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {['{ReferenceNumber}', '{EmployeeName}', '{Province}', '{Severity}', '{Status}', '{Date}', '{CoordinatorName}', '{InvestigatorName}', '{ChiefDirectorName}'].map(v => (
                  <button
                    key={v}
                    onClick={() => handleInsertVariable(v)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', textAlign: 'left', display: 'block', width: '100%', fontFamily: 'monospace' }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM LOGS TAB */}
      {activeTab === 'system_logs' && canManageSystemConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {health && (
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} color="var(--color-primary)" />
                System Health &amp; KPI Metrics (NFR-001)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>APPLICATION UPTIME</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                    {formatUptime(health.uptimeSeconds)}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>DATABASE STATUS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: health.database.status === 'Online' ? '#10b981' : '#ef4444' }} />
                    <span style={{ fontWeight: 700, color: health.database.status === 'Online' ? '#10b981' : '#ef4444' }}>{health.database.status}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>TOTAL SYSTEM ACCOUNTS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                    {health.userCount}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>System Logs (Audit Trails)</h3>
              <input
                type="text"
                placeholder="Filter logs by keyword..."
                className="form-input"
                style={{ maxWidth: '280px', fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                value={logSearchTerm}
                onChange={e => setLogSearchTerm(e.target.value)}
              />
            </div>
            <div className="table-container">
              <table className="custom-table compact">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{log.username}</td>
                      <td><span className="badge muted" style={{ fontSize: '0.7rem' }}>{log.userRole}</span></td>
                      <td><span className={`badge ${log.action === 'ACCESS_DENIED' ? 'danger' : 'primary'}`}>{log.action}</span></td>
                      <td>{log.resource}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No audit logs matched search criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={logPage}
                totalItems={logTotal}
                itemsPerPage={LOGS_PER_PAGE}
                onPageChange={setLogPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* CHECKLISTS TAB */}
      {activeTab === 'checklist' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Operational Checklists</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                System-wide checklist definitions for coordinator triage and investigator evidence collection.
              </p>
            </div>
            <button className="btn btn-success" onClick={handleSaveChecklist} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Save size={14} /> Save Checklists
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {localChecklists.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span className="badge primary" style={{ fontSize: '0.7rem' }}>{item.category}</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ ...smallInput, flexGrow: 1 }}
                  value={item.task}
                  onChange={e => {
                    const next = [...localChecklists];
                    next[idx] = { ...item, task: e.target.value };
                    setLocalChecklists(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAFF VETTING TAB */}
      {activeTab === 'staff' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Personnel Security &amp; Vetting</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            State security clearance records &amp; vetting tracker for departmental staff.
          </p>

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
