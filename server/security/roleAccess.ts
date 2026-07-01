export type SecurityRole =
  | 'employee'
  | 'security_coordinator'
  | 'chief_security_investigator'
  | 'security_director';

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

export const ROLE_LABELS: Record<SecurityRole, string> = {
  employee: 'Employee',
  security_coordinator: 'Security Coordinator',
  chief_security_investigator: 'Chief Security Investigator',
  security_director: 'Security Director'
};

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

export const getUserByUsername = (username: string) => {
  const normalized = username.trim().toLowerCase();
  const canonical = LOGIN_ALIASES[normalized] || normalized;
  return ROLE_USERS.find(user => user.username === canonical);
};

export const getPermissionsForRole = (role: SecurityRole) => ROLE_PERMISSIONS[role] || [];
