import React, { useState } from 'react';
import type { ChecklistItem } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { getPermissionsForRole } from '../security/roleAccess';
import { CheckSquare, Users, Save, UserCog, Settings2, Activity, UserPlus, Pencil, RefreshCw } from 'lucide-react';
import { PROVINCES } from '../data/mockData';
import { useModal } from './NotificationModal';

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

export const AdministrationView: React.FC<AdministrationViewProps> = ({ checklists, onUpdateChecklist, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'staff' | 'roles' | 'config' | 'system'>('checklist');
  const [localChecklists, setLocalChecklists] = useState<ChecklistItem[]>(checklists);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  // Draft leave-allocation values keyed by username (coordinator profile management)
  const [leaveDrafts, setLeaveDrafts] = useState<Record<string, string>>({});
  const { showAlert, showConfirm } = useModal();

  // User management (create/modify/deactivate — FR-036)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: '', email: '', role: '', province: '', office: '', clearanceLevel: '' });

  // System configuration (FR-037/FR-038/FR-039)
  const [configLoaded, setConfigLoaded] = useState(false);
  const [slaDraft, setSlaDraft] = useState<SlaRulesDraft | null>(null);
  const [escalationLevelsDraft, setEscalationLevelsDraft] = useState('');
  const [categoriesDraft, setCategoriesDraft] = useState('');
  const [templatesDraft, setTemplatesDraft] = useState<Record<string, TemplateDraft>>({});

  // System health & logs (FR-040)
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const permissions = getPermissionsForRole(currentUser.role);
  // Leave allocations are managed by the Chief Director only; the System
  // Administrator sees the users list but not the allocation editor.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  const loadHealth = React.useCallback(async () => {
    try {
      const [healthRes, logsRes] = await Promise.all([
        fetch('/api/admin/system-health', { headers: authHeaders }),
        fetch('/api/audit-logs', { headers: authHeaders })
      ]);
      const healthJson = await healthRes.json();
      if (healthJson.success) setHealth(healthJson.data);
      const logsJson = await logsRes.json();
      if (logsJson.success) setAuditLogs(logsJson.data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  React.useEffect(() => {
    if (activeTab === 'roles') loadUsers();
    if (activeTab === 'config' && !configLoaded) loadConfig();
    if (activeTab === 'system') loadHealth();
  }, [activeTab, loadUsers, loadConfig, loadHealth, configLoaded]);

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

  const startEditUser = (user: AdminUser) => {
    setEditingUsername(user.username);
    setEditDraft({
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      province: user.province,
      office: user.office,
      clearanceLevel: user.clearanceLevel
    });
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
        showAlert(`${user.displayName} now has a total leave allocation of ${totalLeaves} day(s).`, 'Leave Allocation Updated', 'success');
        setLeaveDrafts(prev => {
          const next = { ...prev };
          delete next[user.username];
          return next;
        });
        loadUsers();
      } else {
        showAlert(json.error || json.message || 'Update failed.', 'Operation Failed', 'warning');
      }
    } catch {
      showAlert('Update failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

  const handleRevokeTemp = async (user: UserProfile) => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/temp-coordinator`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const json = await res.json();
      if (json.success) {
        showAlert(`${user.displayName} has been returned to their permanent role.`, 'Assignment Revoked', 'success');
        loadUsers();
      } else {
        showAlert(json.message || 'Revoke failed.', 'Operation Failed', 'warning');
      }
    } catch {
      showAlert('Revoke failed — server unreachable.', 'Operation Failed', 'warning');
    }
  };

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

  const smallInput = { padding: '0.35rem 0.5rem', fontSize: '0.8rem' };
  const fieldLabel = { fontSize: '0.72rem', fontWeight: 600 as const, color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'block' };

  return (
    <div>
      <div className="header-row">
        <div>
          <h1 className="page-title">Administration Hub</h1>
          <p className="page-subtitle">Manage users and roles, operational checklists, personnel vetting{canManageSystemConfig ? ', system configuration and monitoring' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
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
        <button
          onClick={() => setActiveTab('roles')}
          className={`btn ${activeTab === 'roles' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Users & Acting Roles
        </button>
        {canManageSystemConfig && (
          <button
            onClick={() => setActiveTab('config')}
            className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            System Configuration
          </button>
        )}
        {canManageSystemConfig && (
          <button
            onClick={() => setActiveTab('system')}
            className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            System Health & Logs
          </button>
        )}
      </div>

      {activeTab === 'roles' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCog size={20} color="var(--color-primary)" />
                Users, Accounts &amp; Temporary Coordinator Assignments
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Create, modify and deactivate departmental accounts (FR-036). When a Security Coordinator goes on
                leave, an employee may be appointed as a <strong>Temporary Security Coordinator</strong> for their
                province with the full rights of a permanent coordinator. Approved leave requests do this
                automatically via the daily leave scheduler.
                {canManageLeaveAllocation && (
                  <> The <strong>Leave Allocation</strong> column sets each coordinator's total leave days.</>
                )}{' '}
                All changes are recorded in the audit trail. In production, accounts are provisioned from Active
                Directory (FR-031) — manual accounts are for the pre-SSO phase.
              </p>
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              onClick={() => setShowAddUser(v => !v)}
            >
              <UserPlus size={14} /> {showAddUser ? 'Close Form' : 'Add User'}
            </button>
          </div>

          {showAddUser && (
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>New Departmental Account</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={fieldLabel}>Username *</label>
                  <input className="form-input" style={smallInput} value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="e.g. jmokoena" />
                </div>
                <div>
                  <label style={fieldLabel}>Full Name *</label>
                  <input className="form-input" style={smallInput} value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="e.g. J. Mokoena" />
                </div>
                <div>
                  <label style={fieldLabel}>Email *</label>
                  <input className="form-input" style={smallInput} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="name@dlrrd.gov.za" />
                </div>
                <div>
                  <label style={fieldLabel}>Role *</label>
                  <select className="form-input" style={smallInput} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    {roleOptions.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Province *</label>
                  <select className="form-input" style={smallInput} value={newUser.province} onChange={e => setNewUser({ ...newUser, province: e.target.value })}>
                    {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Office *</label>
                  <input className="form-input" style={smallInput} value={newUser.office} onChange={e => setNewUser({ ...newUser, office: e.target.value })} placeholder="e.g. Pretoria Headquarters" />
                </div>
                <div>
                  <label style={fieldLabel}>Clearance *</label>
                  <select className="form-input" style={smallInput} value={newUser.clearanceLevel} onChange={e => setNewUser({ ...newUser, clearanceLevel: e.target.value })}>
                    {CLEARANCE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>PERSAL Number</label>
                  <input className="form-input" style={smallInput} value={newUser.persalNumber} onChange={e => setNewUser({ ...newUser, persalNumber: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Designation</label>
                  <input className="form-input" style={smallInput} value={newUser.jobTitle} onChange={e => setNewUser({ ...newUser, jobTitle: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Phone</label>
                  <input className="form-input" style={smallInput} value={newUser.phoneNumber} onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '0.9rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={handleCreateUser}>
                Create Account
              </button>
            </div>
          )}

          {editingUsername && (
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Pencil size={15} /> Editing account: {editingUsername}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={fieldLabel}>Full Name</label>
                  <input className="form-input" style={smallInput} value={editDraft.displayName} onChange={e => setEditDraft({ ...editDraft, displayName: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Email</label>
                  <input className="form-input" style={smallInput} value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Role</label>
                  <select
                    className="form-input"
                    style={smallInput}
                    value={editDraft.role}
                    disabled={editingUsername === currentUser.username}
                    title={editingUsername === currentUser.username ? 'You cannot change your own role' : undefined}
                    onChange={e => setEditDraft({ ...editDraft, role: e.target.value })}
                  >
                    {roleOptions.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Province</label>
                  <select className="form-input" style={smallInput} value={editDraft.province} onChange={e => setEditDraft({ ...editDraft, province: e.target.value })}>
                    {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Office</label>
                  <input className="form-input" style={smallInput} value={editDraft.office} onChange={e => setEditDraft({ ...editDraft, office: e.target.value })} />
                </div>
                <div>
                  <label style={fieldLabel}>Clearance</label>
                  <select className="form-input" style={smallInput} value={editDraft.clearanceLevel} onChange={e => setEditDraft({ ...editDraft, clearanceLevel: e.target.value })}>
                    {CLEARANCE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={handleSaveEdit}>Save Changes</button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setEditingUsername(null)}>Cancel</button>
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
                    <th>User</th>
                    <th>Role</th>
                    <th>Province</th>
                    <th>Office</th>
                    <th>Status</th>
                    {canManageLeaveAllocation && <th>Leave Allocation</th>}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} style={user.isActive === false ? { opacity: 0.55 } : undefined}>
                      <td style={{ fontWeight: 600 }}>{user.displayName}</td>
                      <td><span className="badge primary">{user.roleLabel}</span></td>
                      <td>{user.province}</td>
                      <td>{user.office}</td>
                      <td>
                        {user.isActive === false ? (
                          <span className="badge danger">Deactivated</span>
                        ) : user.baseRole ? (
                          <span className="badge warning">
                            {user.tempAssignedBy?.startsWith('leave-cover:')
                              ? `Acting (leave cover for ${user.tempAssignedBy.slice('leave-cover:'.length)})`
                              : `Acting (assigned by ${user.tempAssignedBy})`}
                          </span>
                        ) : (
                          <span className="badge muted">Active</span>
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
                                style={{ width: '64px', padding: '0.25rem 0.4rem', fontSize: '0.78rem' }}
                              />
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}
                                disabled={leaveDrafts[user.username] === undefined || leaveDrafts[user.username] === String(user.totalLeaves ?? 0)}
                                onClick={() => handleSaveLeaveAllocation(user)}
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {user.isActive !== false && user.baseRole && (
                            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleRevokeTemp(user)}>
                              Revoke Acting Role
                            </button>
                          )}
                          {user.isActive !== false && !user.baseRole && user.role === 'employee' && (
                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleAssignTemp(user)}>
                              Make Temp Coordinator
                            </button>
                          )}
                          {user.isActive !== false && !user.baseRole && (
                            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }} onClick={() => startEditUser(user)}>
                              Edit
                            </button>
                          )}
                          {user.username !== currentUser.username && !user.baseRole && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', color: user.isActive === false ? undefined : 'var(--color-danger)' }}
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.isActive === false ? 'Reactivate' : 'Deactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && canManageSystemConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings2 size={20} color="var(--color-primary)" />
              SLA Rules (FR-037)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Resolution targets per classification drive the On Track / At Risk / Overdue indicators on the
              dashboard and SLA Monitor. Policy deadlines are shown on incident guidance and reports.
            </p>
            {!slaDraft ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading configuration…</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {Object.entries(slaDraft.classificationTargets).map(([classification, hours]) => (
                    <div key={classification}>
                      <label style={fieldLabel}>{classification} (hours)</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        style={smallInput}
                        value={hours}
                        onChange={e => setSlaDraft({
                          ...slaDraft,
                          classificationTargets: { ...slaDraft.classificationTargets, [classification]: e.target.value }
                        })}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={fieldLabel}>Default target (hours)</label>
                    <input type="number" min={1} className="form-input" style={smallInput} value={slaDraft.defaultTargetHours} onChange={e => setSlaDraft({ ...slaDraft, defaultTargetHours: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>At Risk threshold (% of target remaining)</label>
                    <input type="number" min={1} max={99} className="form-input" style={smallInput} value={slaDraft.atRiskThresholdPercent} onChange={e => setSlaDraft({ ...slaDraft, atRiskThresholdPercent: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Full report due (days)</label>
                    <input type="number" min={1} className="form-input" style={smallInput} value={slaDraft.fullReportDays} onChange={e => setSlaDraft({ ...slaDraft, fullReportDays: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Breach to SSA (hours)</label>
                    <input type="number" min={1} className="form-input" style={smallInput} value={slaDraft.breachToSsaHours} onChange={e => setSlaDraft({ ...slaDraft, breachToSsaHours: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Investigation (working days)</label>
                    <input type="number" min={1} className="form-input" style={smallInput} value={slaDraft.investigationWorkingDays} onChange={e => setSlaDraft({ ...slaDraft, investigationWorkingDays: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveSlaRules}>
                  <Save size={14} /> Save SLA Rules
                </button>
              </>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Escalation Matrix (FR-037)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Permitted escalation levels, one per line, in ascending order of severity. Escalated cases route to
              the Security Director, who assigns the Chief Investigator. Escalations using a level not on this
              list are rejected.
            </p>
            <textarea
              className="form-input"
              style={{ ...smallInput, minHeight: '110px', fontFamily: 'inherit' }}
              value={escalationLevelsDraft}
              onChange={e => setEscalationLevelsDraft(e.target.value)}
            />
            <button className="btn btn-primary" style={{ marginTop: '0.75rem', padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveEscalation}>
              <Save size={14} /> Save Escalation Matrix
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Incident Categories (FR-039)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Incident types offered on the NOC notification form, one per line. Reporters can still describe
              non-listed incidents under "Other". Keep names aligned with the official paper form — officials
              know them by heart.
            </p>
            <textarea
              className="form-input"
              style={{ ...smallInput, minHeight: '220px', fontFamily: 'inherit' }}
              value={categoriesDraft}
              onChange={e => setCategoriesDraft(e.target.value)}
            />
            <button className="btn btn-primary" style={{ marginTop: '0.75rem', padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveCategories}>
              <Save size={14} /> Save Incident Categories
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Notification Templates (FR-038)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Used for email and in-app alerts (FR-008). Placeholders: <code>{'{{refNo}}'}</code>, <code>{'{{province}}'}</code>,{' '}
              <code>{'{{classification}}'}</code>, <code>{'{{reportedBy}}'}</code>, <code>{'{{level}}'}</code>,{' '}
              <code>{'{{reason}}'}</code>, <code>{'{{escalatedBy}}'}</code>.
            </p>
            {Object.entries(templatesDraft).map(([key, tpl]) => (
              <div key={key} style={{ marginBottom: '1rem' }}>
                <label style={{ ...fieldLabel, fontSize: '0.8rem' }}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                <input
                  className="form-input"
                  style={{ ...smallInput, marginBottom: '0.4rem' }}
                  value={tpl.title}
                  onChange={e => setTemplatesDraft({ ...templatesDraft, [key]: { ...tpl, title: e.target.value } })}
                  placeholder="Notification title"
                />
                <textarea
                  className="form-input"
                  style={{ ...smallInput, minHeight: '60px', fontFamily: 'inherit' }}
                  value={tpl.message}
                  onChange={e => setTemplatesDraft({ ...templatesDraft, [key]: { ...tpl, message: e.target.value } })}
                  placeholder="Notification message"
                />
              </div>
            ))}
            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleSaveTemplates}>
              <Save size={14} /> Save Templates
            </button>
          </div>
        </div>
      )}

      {activeTab === 'system' && canManageSystemConfig && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} color="var(--color-primary)" />
                System Performance &amp; Availability (NFR-001)
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={loadHealth}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            {!health ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading system health…</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="glass-card" style={{ padding: '0.9rem' }}>
                    <div style={fieldLabel}>Database</div>
                    <div style={{ fontWeight: 600 }}>{health.database.engine}</div>
                    <span className={`badge ${health.database.status === 'Online' ? 'success' : 'danger'}`} style={{ marginTop: '0.3rem' }}>
                      {health.database.status} · {health.database.latencyMs}ms
                    </span>
                  </div>
                  <div className="glass-card" style={{ padding: '0.9rem' }}>
                    <div style={fieldLabel}>Server Uptime</div>
                    <div style={{ fontWeight: 600 }}>{formatUptime(health.server.uptimeSeconds)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Node {health.server.nodeVersion}</div>
                  </div>
                  <div className="glass-card" style={{ padding: '0.9rem' }}>
                    <div style={fieldLabel}>Memory</div>
                    <div style={{ fontWeight: 600 }}>{health.server.memoryRssMb} MB RSS</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{health.server.heapUsedMb} MB heap used</div>
                  </div>
                  <div className="glass-card" style={{ padding: '0.9rem' }}>
                    <div style={fieldLabel}>Records</div>
                    <div style={{ fontSize: '0.78rem' }}>
                      {health.database.counts.users ?? 0} users · {health.database.counts.incidents ?? 0} incidents<br />
                      {health.database.counts.notifications ?? 0} notifications · {health.database.counts.audit_logs ?? 0} audit entries
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
                  {Object.entries(health.compliance as Record<string, string>).map(([key, text]) => (
                    <div key={key} className="glass-card" style={{ padding: '0.9rem' }}>
                      <div style={fieldLabel}>{key.replace(/\b\w/g, c => c.toUpperCase())}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>System Logs — Audit Trail (FR-035)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Most recent 100 entries of the immutable audit trail. Entries are never edited or deleted.
            </p>
            <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="custom-table">
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
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleString('en-ZA')}</td>
                      <td style={{ fontWeight: 600 }}>{log.username}</td>
                      <td style={{ fontSize: '0.75rem' }}>{log.userRole}</td>
                      <td><span className={`badge ${log.action === 'ACCESS_DENIED' ? 'danger' : 'primary'}`}>{log.action}</span></td>
                      <td style={{ fontSize: '0.78rem' }}>{log.resource}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.details}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No audit entries found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checklist' && (
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
      )}

      {activeTab === 'staff' && (
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
