// Role model — client role/responsibility matrix (July 2026).
// Five roles: Employee, Security Coordinator, Chief Investigator, Chief Security Director,
// System Administrator (ICT/MTS — users, roles, permissions, SLA configurations,
// notification templates, escalation rules and overall system administration).
// Internal keys 'security_coordinator', 'chief_security_investigator' and
// 'security_director' are kept for backward compatibility with stored records,
// sessions and audit logs; labels/codes carry the current official terminology.
//
// Retired roles (migrated on boot, see config/db.ts):
//   assistant_coordinator  -> security_coordinator
//   executive              -> account deactivated
//   system_administrator   -> reinstated (July 2026) as the fifth role; previously
//                             deactivated accounts are reactivated on boot
export type SecurityRole =
  | 'employee'
  | 'security_coordinator'
  | 'chief_security_investigator'
  | 'security_director'
  | 'system_administrator';

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

/** The only profile fields a user may change themselves — identity fields come from AD/HR (FR-005, FR-031). */
export const SELF_EDITABLE_PROFILE_FIELDS = ['phoneNumber', 'jobTitle'] as const;

export const DEFAULT_DIRECTORATE = 'Chief Directorate: Security and Facilities Management Services';

export const ROLE_CODES: Record<SecurityRole, string> = {
  employee: 'EMP',
  security_coordinator: 'SECCO',
  chief_security_investigator: 'CHINV',
  security_director: 'CHDIR',
  system_administrator: 'SYSADM'
};

export const ROLE_LABELS: Record<SecurityRole, string> = {
  employee: 'Employee',
  security_coordinator: 'Security Coordinator',
  chief_security_investigator: 'Chief Investigator',
  security_director: 'Chief Security Director',
  system_administrator: 'System Administrator'
};

// Roles whose data scope is national (see everything across provinces)
export const NATIONAL_ROLES: SecurityRole[] = ['security_director'];

// Roles whose data scope is their own province
export const PROVINCIAL_ROLES: SecurityRole[] = ['security_coordinator'];

// Permissions follow the client responsibility matrix:
// - Employee: report/raise + track incidents; AI chatbot (register, track, questions, own profile).
// - Security Coordinator: approves cases; closes small cases with reports/attachments; escalates
//   significant cases to the Chief Security Director; provincial dashboard; AI case analysis/brief;
//   sees who raised a case and their contact information.
// - Chief Investigator: only sees cases assigned by the Chief Security Director; collects field data
//   onto the case; moves the case to approval — the cycle repeats until the Director approves closure.
// - Chief Security Director: oversees all provinces; assigns investigators; approves closures; can appoint
//   any employee as a temporary Security Coordinator (e.g. leave cover) with full coordinator rights.
// - System Administrator (ICT/MTS): manages users, roles, permissions, SLA configurations,
//   notification templates, escalation rules and overall system administration (FR-036–FR-040);
//   no incident case-data scope beyond their own reported incidents.
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
    'ai:chat',
    'leave:review',
    'leave:manage_allocation'
  ],
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
  clearanceLevel: UserProfile['clearanceLevel'],
  persalNumber?: string,
  jobTitle?: string,
  phoneNumber?: string
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
  persalNumber: persalNumber || '',
  jobTitle: jobTitle || ROLE_LABELS[role],
  phoneNumber: phoneNumber || '',
  directorate: DEFAULT_DIRECTORATE,
  lastLoginAt: null,
  passwordChangedAt: null,
  preferences: { ...DEFAULT_PREFERENCES }
});

// Seed accounts — the users table is seeded from this list on first run.
// Once AD SSO is integrated, rows come from AD provisioning instead.
// Client staffing: ~15 employees, ~18 coordinators nationally; one representative
// account per role/province combination is seeded for development.
export const ROLE_USERS: UserProfile[] = [
  buildUser('usr-employee-001', 'employee', 'Employee User', 'employee@dlrrd.gov.za', 'employee', 'Gauteng', 'Pretoria Headquarters', 'Restricted', '10233245', 'Administrative Officer', '012 312 8911'),
  buildUser('usr-employee-002', 'employee2', 'Employee User 2', 'employee2@dlrrd.gov.za', 'employee', 'Western Cape', 'Cape Town Provincial Office', 'Restricted', '10287410', 'Administrative Clerk', '021 409 0300'),
  buildUser('usr-coordinator-001', 'coordinator', 'Security Coordinator 1 (Gauteng)', 'coordinator1.gp@dlrrd.gov.za', 'security_coordinator', 'Gauteng', 'Pretoria Headquarters', 'Secret', '10112233', 'Senior Security Supervisor', '012 312 8624'),
  buildUser('usr-coordinator-002', 'coordinator2', 'Security Coordinator 2 (Gauteng)', 'coordinator2.gp@dlrrd.gov.za', 'security_coordinator', 'Gauteng', 'Johannesburg Regional Office', 'Secret', '10118844', 'Security Coordinator', '011 240 2500'),
  buildUser('usr-coordinator-wc', 'coordinator_wc', 'Security Coordinator (Western Cape)', 'coordinator.wc@dlrrd.gov.za', 'security_coordinator', 'Western Cape', 'Cape Town Provincial Office', 'Secret', '10125521', 'Security Coordinator', '021 409 0345'),
  buildUser('usr-investigator-001', 'investigator', 'Chief Investigator', 'investigator@dlrrd.gov.za', 'chief_security_investigator', 'National', 'Field Investigation Unit', 'Top Secret', '10099001', 'Chief Security Investigator', '012 312 8688'),
  buildUser('usr-director-001', 'director', 'Chief Security Director', 'director@dlrrd.gov.za', 'security_director', 'National', 'National Security Directorate', 'Top Secret', '10011001', 'Chief Security Director: Security Services', '012 312 8600'),
  buildUser('usr-sysadmin-001', 'sysadmin', 'System Administrator', 'sysadmin@dlrrd.gov.za', 'system_administrator', 'National', 'ICT / MTS — National Office', 'Secret', '10066002', 'System Administrator (ICT/MTS)', '012 312 8700')
];

export const LOGIN_ALIASES: Record<string, string> = {
  supervisor: 'coordinator'
};

export const getUserByUsername = (username: string) => {
  const normalized = username.trim().toLowerCase();
  const canonical = LOGIN_ALIASES[normalized] || normalized;
  return ROLE_USERS.find(user => user.username === canonical);
};

export const getPermissionsForRole = (role: SecurityRole) => ROLE_PERMISSIONS[role] || [];

export const isNationalRole = (role: SecurityRole) => NATIONAL_ROLES.includes(role);
export const isProvincialRole = (role: SecurityRole) => PROVINCIAL_ROLES.includes(role);

export const isValidRole = (role: string): role is SecurityRole =>
  Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role);
