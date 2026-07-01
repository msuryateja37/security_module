import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Briefcase,
  ClipboardCheck,
  Clock,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  BookOpen
} from 'lucide-react';

export type SecurityRole =
  | 'employee'
  | 'security_coordinator'
  | 'chief_security_investigator'
  | 'security_director';

export type AppView =
  | 'dashboard'
  | 'submit_reports'
  | 'my_cases'
  | 'register'
  | 'approval'
  | 'sla_monitor'
  | 'reports_archive'
  | 'administration'
  | 'policy';

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
  | 'investigation:approve'
  | 'reports:submit_operational'
  | 'reports:view_archive'
  | 'sla:view'
  | 'admin:manage_roles'
  | 'ai:chat';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: SecurityRole;
  roleLabel: string;
  province: string;
  office: string;
  clearanceLevel: 'Public' | 'Restricted' | 'Confidential' | 'Secret' | 'Top Secret';
}

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

export const ROLE_LABELS: Record<SecurityRole, string> = {
  employee: 'Employee',
  security_coordinator: 'Security Coordinator',
  chief_security_investigator: 'Chief Security Investigator',
  security_director: 'Security Director'
};

export const ROLE_PERMISSIONS: Record<SecurityRole, Permission[]> = {
  employee: [
    'dashboard:view',
    'incident:create',
    'incident:track_own',
    'ai:chat'
  ],
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
    'ai:chat'
  ],
  chief_security_investigator: [
    'dashboard:view',
    'incident:view_assigned',
    'incident:update',
    'investigation:submit',
    'reports:view_archive',
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
    'investigation:approve',
    'reports:view_archive',
    'sla:view',
    'admin:manage_roles',
    'ai:chat'
  ]
};

export const ROLE_USERS: UserProfile[] = [
  {
    id: 'usr-employee-001',
    username: 'employee',
    displayName: 'Employee User',
    email: 'employee@dlrrd.gov.za',
    role: 'employee',
    roleLabel: ROLE_LABELS.employee,
    province: 'Gauteng',
    office: 'Pretoria Headquarters',
    clearanceLevel: 'Restricted'
  },
  {
    id: 'usr-coordinator-001',
    username: 'coordinator',
    displayName: 'Security Coordinator 1 (Gauteng)',
    email: 'coordinator1.gp@dlrrd.gov.za',
    role: 'security_coordinator',
    roleLabel: ROLE_LABELS.security_coordinator,
    province: 'Gauteng',
    office: 'Pretoria Headquarters',
    clearanceLevel: 'Secret'
  },
  {
    id: 'usr-coordinator-002',
    username: 'coordinator2',
    displayName: 'Security Coordinator 2 (Gauteng)',
    email: 'coordinator2.gp@dlrrd.gov.za',
    role: 'security_coordinator',
    roleLabel: ROLE_LABELS.security_coordinator,
    province: 'Gauteng',
    office: 'Johannesburg Regional Office',
    clearanceLevel: 'Secret'
  },
  {
    id: 'usr-coordinator-wc',
    username: 'coordinator_wc',
    displayName: 'Security Coordinator (Western Cape)',
    email: 'coordinator.wc@dlrrd.gov.za',
    role: 'security_coordinator',
    roleLabel: ROLE_LABELS.security_coordinator,
    province: 'Western Cape',
    office: 'Cape Town Provincial Office',
    clearanceLevel: 'Secret'
  },
  {
    id: 'usr-investigator-001',
    username: 'investigator',
    displayName: 'Chief Security Investigator',
    email: 'investigator@dlrrd.gov.za',
    role: 'chief_security_investigator',
    roleLabel: ROLE_LABELS.chief_security_investigator,
    province: 'National',
    office: 'Field Investigation Unit',
    clearanceLevel: 'Top Secret'
  },
  {
    id: 'usr-director-001',
    username: 'director',
    displayName: 'Security Director',
    email: 'director@dlrrd.gov.za',
    role: 'security_director',
    roleLabel: ROLE_LABELS.security_director,
    province: 'National',
    office: 'National Security Directorate',
    clearanceLevel: 'Top Secret'
  }
];

export const LOGIN_ALIASES: Record<string, string> = {
  supervisor: 'coordinator'
};

export const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'submit_reports', label: 'Submit Reports', icon: FileText, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'my_cases', label: 'My Cases', icon: Briefcase, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'register', label: 'Investigation', icon: Search, roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'approval', label: 'Approval', icon: ClipboardCheck, roles: ['security_coordinator', 'security_director'] },
  { view: 'sla_monitor', label: 'SLA Monitor', icon: Clock, roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'reports_archive', label: 'Reports', icon: Archive, roles: ['security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'policy', label: 'Policy Hub', icon: BookOpen, roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director'] },
  { view: 'administration', label: 'Administration', icon: Settings, roles: ['security_director'] }
];

export const REPORT_TABS: ReportTab[] = [
  { view: 'incident', label: 'Incident Notification', roles: ['employee', 'security_coordinator', 'chief_security_investigator', 'security_director'] },
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

export const getViewLabelForRole = (view: AppView, role: SecurityRole): string => {
  if (view === 'my_cases') {
    return role === 'employee' ? 'Track My Incidents' : 'My Assigned Cases';
  }

  return NAV_ITEMS.find(item => item.view === view)?.label || 'Dashboard';
};

export const reviveStoredUser = (value: string | null): UserProfile | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as UserProfile;
    if (parsed?.username && parsed?.role) {
      return parsed;
    }
  } catch {
    return getUserByUsername(value) || null;
  }

  return getUserByUsername(value) || null;
};
