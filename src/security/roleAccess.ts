import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  BookOpen,
  Sparkles
} from 'lucide-react';

// Role model — client role/responsibility matrix (July 2026).
// Five roles: Employee, Security Coordinator, Chief Investigator, Chief Security Director,
// System Administrator (ICT/MTS — users, roles, permissions, SLA configurations,
// notification templates, escalation rules and overall system administration).
// Internal keys 'security_coordinator', 'chief_security_investigator' and
// 'security_director' are kept for backward compatibility with stored records,
// sessions and audit logs; labels/codes carry the current official terminology.
export type SecurityRole =
  | 'employee'
  | 'security_coordinator'
  | 'chief_security_investigator'
  | 'deputy_director'
  | 'security_director'
  | 'system_administrator';

export type AppView =
  | 'dashboard'
  | 'submit_reports'
  | 'my_cases'
  | 'register'
  | 'approval'
  | 'sla_monitor'
  | 'reports_archive'
  | 'administration'
  | 'policy'
  | 'assistant'
  | 'profile'
  | 'leaves'
  | 'leave_management'
  | 'case_detail';

export type ReportSubView = 'incident' | 'bto' | 'investigation' | 'stats' | 'quarterly' | 'tra';

export type Permission =
  | 'dashboard:view'
  | 'incident:create'
  | 'incident:track_own'
  | 'incident:view_province'
  | 'incident:view_assigned'
  | 'incident:view_all'
  | 'incident:update'
  | 'case:approve'
  | 'case:close'
  | 'case:escalate'
  | 'case:assign_investigator'
  | 'investigation:submit'
  | 'investigation:verify'
  | 'investigation:approve'
  | 'reports:submit_operational'
  | 'reports:view_archive'
  | 'sla:view'
  | 'admin:manage_roles'
  | 'admin:system_config'
  | 'ai:chat'
  | 'leave:request'
  | 'leave:review'
  | 'leave:manage_allocation';

/** Per-user notification settings (FR-008: email AND in-system alerts; NFR-006: ≤2 min delivery). */
export interface UserPreferences {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  slaReminders: boolean;
  monthlyDigest: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  inAppNotifications: true,
  slaReminders: true,
  monthlyDigest: false
};

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: SecurityRole;
  roleCode: string;
  roleLabel: string;
  province: string;
  office: string;
  clearanceLevel: 'Public' | 'Restricted' | 'Confidential' | 'Secret' | 'Top Secret';
  /** Set while the user is acting as a temporary Security Coordinator — holds their permanent role. */
  baseRole?: SecurityRole | null;
  /** Username of the Chief Security Director who made the temporary assignment. */
  tempAssignedBy?: string | null;
  /** PERSAL number — government HR identifier. HR/AD-sourced (FR-005), read-only in the portal. */
  persalNumber?: string;
  /** Designation as written on official forms (e.g. "Senior Security Supervisor"). */
  jobTitle?: string;
  /** Work contact number shown on incident notifications and reports. */
  phoneNumber?: string;
  /** Organisational unit; defaults to CD: Security and Facilities Management Services. */
  directorate?: string;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  preferences?: UserPreferences;
  /** Running leave-day allocation, managed by the Chief Security Director (coordinators only). */
  totalLeaves?: number;
}

export const DEFAULT_DIRECTORATE = 'Chief Directorate: Security and Facilities Management Services';

export interface NavItem {
  view: AppView;
  label: string;
  icon: LucideIcon;
  roles: SecurityRole[];
}

export interface ReportTab {
  view: ReportSubView;
  label: string;
  roles: SecurityRole[];
}

export const ROLE_CODES: Record<SecurityRole, string> = {
  employee: 'EMP',
  security_coordinator: 'SECCO',
  chief_security_investigator: 'CHINV',
  deputy_director: 'DEPDIR',
  security_director: 'CHDIR',
  system_administrator: 'SYSADM'
};

export const ROLE_LABELS: Record<SecurityRole, string> = {
  employee: 'Employee',
  security_coordinator: 'Security Coordinator',
  chief_security_investigator: 'Chief Investigator',
  deputy_director: 'Deputy Director',
  security_director: 'Chief Security Director',
  system_administrator: 'System Administrator'
};

// Roles whose data scope is national (see everything across provinces)
export const NATIONAL_ROLES: SecurityRole[] = ['deputy_director', 'security_director'];

// Roles whose data scope is their own province
export const PROVINCIAL_ROLES: SecurityRole[] = ['security_coordinator'];

// Permissions follow the client responsibility matrix — see server/security/roleAccess.ts
// for the full annotated version. The two files must stay in sync.
export const ROLE_PERMISSIONS: Record<SecurityRole, Permission[]> = {
  employee: ['dashboard:view', 'incident:create', 'incident:track_own', 'ai:chat'],
  security_coordinator: [
    'dashboard:view',
    'incident:create',
    'incident:view_province',
    'incident:update',
    'case:approve',
    'case:close',
    'case:escalate',
    'reports:submit_operational',
    'reports:view_archive',
    'sla:view',
    'ai:chat',
    'leave:request'
  ],
  chief_security_investigator: [
    'dashboard:view',
    'incident:view_assigned',
    'incident:update',
    'investigation:submit',
    'reports:view_archive',
    'ai:chat'
  ],
  // Deputy Director (v2): national verification & recommendations layer between
  // the Coordinator/Investigator and the Chief Security Director.
  deputy_director: [
    'dashboard:view',
    'incident:create',
    'incident:view_all',
    'incident:update',
    'investigation:verify',
    'reports:view_archive',
    'sla:view',
    'ai:chat'
  ],
  security_director: [
    'dashboard:view',
    'incident:view_all',
    'incident:update',
    'case:approve',
    'case:close',
    'case:escalate',
    'case:assign_investigator',
    'investigation:verify',
    'investigation:approve',
    'reports:view_archive',
    'sla:view',
    'admin:manage_roles',
    'ai:chat',
    'leave:review',
    'leave:manage_allocation'
  ],
  // System Administrator (ICT/MTS): manages users, roles, permissions, SLA
  // configurations, notification templates and escalation rules (FR-036–FR-040).
  // No incident case-data scope beyond their own reported incidents.
  system_administrator: [
    'dashboard:view',
    'incident:create',
    'incident:track_own',
    'admin:manage_roles',
    'admin:system_config',
    'ai:chat'
  ]
};

const buildUser = (
  id: string,
  username: string,
  displayName: string,
  email: string,
  role: SecurityRole,
  province: string,
  office: string,
  clearanceLevel: UserProfile['clearanceLevel']
): UserProfile => ({
  id,
  username,
  displayName,
  email,
  role,
  roleCode: ROLE_CODES[role],
  roleLabel: ROLE_LABELS[role],
  province,
  office,
  clearanceLevel,
  baseRole: null,
  tempAssignedBy: null,
  persalNumber: '',
  jobTitle: ROLE_LABELS[role],
  phoneNumber: '',
  directorate: DEFAULT_DIRECTORATE,
  lastLoginAt: null,
  passwordChangedAt: null,
  preferences: { ...DEFAULT_PREFERENCES }
});

export const ROLE_USERS: UserProfile[] = [
  buildUser('usr-employee-001', 'employee', 'Employee User', 'employee@dlrrd.gov.za', 'employee', 'Gauteng', 'Pretoria Headquarters', 'Restricted'),
  buildUser('usr-employee-002', 'employee2', 'Employee User 2', 'employee2@dlrrd.gov.za', 'employee', 'Western Cape', 'Cape Town Provincial Office', 'Restricted'),
  buildUser('usr-coordinator-001', 'coordinator', 'Security Coordinator 1 (Gauteng)', 'coordinator1.gp@dlrrd.gov.za', 'security_coordinator', 'Gauteng', 'Pretoria Headquarters', 'Secret'),
  buildUser('usr-coordinator-002', 'coordinator2', 'Security Coordinator 2 (Gauteng)', 'coordinator2.gp@dlrrd.gov.za', 'security_coordinator', 'Gauteng', 'Johannesburg Regional Office', 'Secret'),
  buildUser('usr-coordinator-wc', 'coordinator_wc', 'Security Coordinator (Western Cape)', 'coordinator.wc@dlrrd.gov.za', 'security_coordinator', 'Western Cape', 'Cape Town Provincial Office', 'Secret'),
  buildUser('usr-investigator-001', 'investigator', 'Chief Investigator', 'investigator@dlrrd.gov.za', 'chief_security_investigator', 'National', 'Field Investigation Unit', 'Top Secret'),
  buildUser('usr-deputydirector-001', 'deputydirector', 'Deputy Director', 'deputydirector@dlrrd.gov.za', 'deputy_director', 'National', 'National Security Directorate', 'Top Secret'),
  buildUser('usr-director-001', 'director', 'Chief Security Director', 'director@dlrrd.gov.za', 'security_director', 'National', 'National Security Directorate', 'Top Secret'),
  buildUser('usr-sysadmin-001', 'sysadmin', 'System Administrator', 'sysadmin@dlrrd.gov.za', 'system_administrator', 'National', 'ICT / MTS — National Office', 'Secret')
];

export const LOGIN_ALIASES: Record<string, string> = {
  supervisor: 'coordinator',
  dd: 'deputydirector',
  deputy: 'deputydirector'
};

export const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director', 'system_administrator'] },
  { view: 'submit_reports', label: 'Submit Reports', icon: FileText, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director', 'system_administrator'] },
  { view: 'my_cases', label: 'My Cases', icon: Briefcase, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director', 'system_administrator'] },
  { view: 'register', label: 'Investigation', icon: Search, roles: ['security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director'] },
  { view: 'approval', label: 'Approval', icon: ClipboardCheck, roles: ['security_coordinator', 'deputy_director', 'security_director'] },
  { view: 'sla_monitor', label: 'SLA Monitor', icon: Clock, roles: ['security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director'] },
  { view: 'reports_archive', label: 'Reports', icon: Archive, roles: ['security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director'] },
  { view: 'leaves', label: 'Leaves Management', icon: CalendarDays, roles: ['security_coordinator'] },
  { view: 'leave_management', label: 'Leave Management', icon: CalendarCheck, roles: ['security_director'] },
  { view: 'assistant', label: 'AI Assistant', icon: Sparkles, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director', 'system_administrator'] },
  { view: 'policy', label: 'Policy Hub', icon: BookOpen, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director', 'system_administrator'] },
  { view: 'administration', label: 'Administration', icon: Settings, roles: ['security_director', 'system_administrator'] }
];

export const REPORT_TABS: ReportTab[] = [
  { view: 'incident', label: 'Incident Notification', roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'deputy_director', 'security_director', 'system_administrator'] },
  { view: 'bto', label: 'Back to Office Report', roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'investigation', label: 'Investigation Report', roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'stats', label: 'Monthly Performance Statistics', roles: ['security_coordinator', 'security_director'] },
  { view: 'quarterly', label: 'Monthly & Quarterly Report', roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'tra', label: 'TRA Checklist', roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] }
];

export const getUserByUsername = (username: string): UserProfile | undefined => {
  const normalized = username.trim().toLowerCase();
  const canonical = LOGIN_ALIASES[normalized] || normalized;
  return ROLE_USERS.find(user => user.username === canonical);
};

export const canAccessView = (role: SecurityRole, view: AppView) => {
  // 'profile' is not a sidebar item — every authenticated user can open their own profile.
  // 'case_detail' (#/case/<id>) is reachable by every role; the server enforces
  // record-level access to the actual case file.
  if (view === 'profile' || view === 'case_detail') return true;
  return NAV_ITEMS.some(item => item.view === view && item.roles.includes(role));
};

export const canAccessReportTab = (role: SecurityRole, view: ReportSubView) => {
  return REPORT_TABS.some(tab => tab.view === view && tab.roles.includes(role));
};

export const getDefaultViewForRole = (role: SecurityRole): AppView => {
  return NAV_ITEMS.find(item => item.roles.includes(role))?.view || 'dashboard';
};

export const getDefaultReportTabForRole = (role: SecurityRole): ReportSubView => {
  return REPORT_TABS.find(tab => tab.roles.includes(role))?.view || 'incident';
};

export const getPermissionsForRole = (role: SecurityRole) => ROLE_PERMISSIONS[role] || [];

export const isNationalRole = (role: SecurityRole) => NATIONAL_ROLES.includes(role);
export const isProvincialRole = (role: SecurityRole) => PROVINCIAL_ROLES.includes(role);

export const isValidRole = (role: string): role is SecurityRole =>
  Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role);

export const getViewLabelForRole = (view: AppView, role: SecurityRole): string => {
  if (view === 'my_cases') {
    // Employees and the System Administrator only track their own reported incidents
    return role === 'employee' || role === 'system_administrator' ? 'Track My Incidents' : 'My Assigned Cases';
  }
  if (view === 'profile') {
    return 'My Profile';
  }

  return NAV_ITEMS.find(item => item.view === view)?.label || 'Dashboard';
};

export const reviveStoredUser = (value: string | null): UserProfile | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as UserProfile;
    if (parsed?.username && parsed?.role) {
      // Sessions stored under the old 7-role model (or before role codes) are
      // stale — force a fresh login so the server issues the migrated profile.
      if (!isValidRole(parsed.role) || !parsed.roleCode) {
        return getUserByUsername(parsed.username) || null;
      }
      return parsed;
    }
  } catch {
    return getUserByUsername(value) || null;
  }

  return getUserByUsername(value) || null;
};
