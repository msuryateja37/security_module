import { execute, query } from '../config/db.js';

// System configuration store (FR-037 SLA rules & escalation matrices, FR-038
// notification templates, FR-039 incident categories & system parameters).
// Managed by the System Administrator (admin:system_config); values live in the
// system_config table as JSON and shallow-merge over the code defaults below,
// so new fields added in code pick up their default until an admin saves them.

export interface SlaRules {
  /** Resolution target in hours per incident classification. */
  classificationTargets: Record<string, number>;
  /** Fallback target when a classification has no explicit entry. */
  defaultTargetHours: number;
  /** Remaining time (as % of target) under which an open incident becomes At Risk. */
  atRiskThresholdPercent: number;
  /** Security-policy deadline: full incident report due (days). */
  fullReportDays: number;
  /** Security-policy deadline: security breach reported to SSA (hours). */
  breachToSsaHours: number;
  /** Security-policy deadline: internal investigation completed (working days). */
  investigationWorkingDays: number;
}

export interface EscalationRules {
  /** Permitted escalation levels, in ascending order of severity. */
  levels: string[];
  /** Role that receives escalated cases (the national escalation target). */
  notifyRole: string;
}

export interface IncidentCategories {
  /** Official incident types shown on the NOC notification form (FR-039). */
  incidentTypes: string[];
}

export interface NotificationTemplate {
  title: string;
  message: string;
}

export type NotificationTemplates = Record<string, NotificationTemplate>;

export interface SystemConfig {
  sla_rules: SlaRules;
  escalation_rules: EscalationRules;
  incident_categories: IncidentCategories;
  notification_templates: NotificationTemplates;
}

export type SystemConfigKey = keyof SystemConfig;

// Official incident-type list from the NOC notification form (BRS / paper form)
const DEFAULT_INCIDENT_TYPES = [
  'Loss of information', 'Armed Robbery', 'Violence (workplace)', 'Conflict of interest',
  'Malicious damage to property', 'Trespassing', 'Bomb Threat', 'Robbery', 'Fraud',
  'Extortion', 'Sabotage', 'Drugs', 'Harassment', 'Assault', 'Theft', 'Kidnapping',
  'Arson', 'Pouching', 'Accidental Discharge of a firearm', 'Acts of terrorism / terror',
  'Violation of permit system', 'Fire', 'Explosion', 'Hostage situation', 'Firearm related',
  'Permit related', 'Firearm left unattended', 'Accidental damage to property'
];

export const CONFIG_DEFAULTS: SystemConfig = {
  sla_rules: {
    classificationTargets: {
      'Top Secret': 24,
      'Secret': 24,
      'Confidential': 72,
      'Restricted': 72,
      'Unclassified': 120
    },
    defaultTargetHours: 72,
    atRiskThresholdPercent: 25,
    fullReportDays: 14,
    breachToSsaHours: 48,
    investigationWorkingDays: 14
  },
  escalation_rules: {
    levels: ['Major', 'High Risk', 'Critical', 'National Review'],
    notifyRole: 'security_director'
  },
  incident_categories: {
    incidentTypes: DEFAULT_INCIDENT_TYPES
  },
  notification_templates: {
    incident_reported: {
      title: 'New incident {{refNo}} reported',
      message: 'A new security incident {{refNo}} ({{classification}}) was reported in {{province}} by {{reportedBy}}. Please review it under My Cases.'
    },
    incident_escalated: {
      title: 'Incident {{refNo}} escalated — {{level}}',
      message: '{{escalatedBy}} escalated incident {{refNo}} ({{province}}) to you. Level: {{level}}. Reason: {{reason}}.'
    },
    // Reporter confirmation on submission (FR-008: email + in-app)
    incident_confirmation: {
      title: 'Incident {{refNo}} received',
      message: 'Your security incident report {{refNo}} has been registered and routed to the {{province}} Security Coordinator. Expected resolution window: {{natureOfCase}}. You can track progress under Track My Incidents.'
    },
    case_review_started: {
      title: 'Case {{refNo}} under investigation',
      message: '{{coordinator}} has accepted your incident {{refNo}} and started the preliminary investigation.'
    },
    case_assigned: {
      title: 'Case {{refNo}} assigned to you',
      message: '{{assignedBy}} assigned case {{refNo}} ({{province}}) to you for field investigation. {{instructions}}'
    },
    investigation_submitted: {
      title: 'Investigation for {{refNo}} awaiting approval',
      message: '{{investigator}} submitted field investigation findings for case {{refNo}}. Please review and approve or return the investigation.'
    },
    case_returned: {
      title: 'Investigation for {{refNo}} returned',
      message: '{{director}} returned the investigation for case {{refNo}}. Reason: {{reason}}. Please continue the field investigation and resubmit.'
    },
    case_approved: {
      title: 'Case {{refNo}} approved for closure',
      message: '{{director}} approved the investigation for case {{refNo}}. The case is ready to be closed with an outcome classification.'
    },
    case_closed: {
      title: 'Case {{refNo}} closed — {{outcome}}',
      message: 'Your security incident {{refNo}} has been closed by {{closedBy}}. Outcome: {{outcome}}. {{summary}}'
    },
    // Oversight copy to the Chief Security Director whenever someone else closes a case
    case_closed_oversight: {
      title: 'Case {{refNo}} closed — {{outcome}}',
      message: '{{closedBy}} closed case {{refNo}} ({{province}}). Outcome: {{outcome}}. {{summary}}'
    },
    // Oversight copy to the Chief Security Director when a case gets a responsible coordinator
    case_assignment_update: {
      title: 'Case {{refNo}} assigned — {{province}}',
      message: '{{actor}} assigned case {{refNo}} ({{province}}) to {{coordinator}} for preliminary review.'
    },
    // Generic progress update to the original reporter — sent for every case
    // activity performed by someone else (uploads, findings, escalation,
    // assignment, approval decisions), so the employee always sees movement.
    case_activity: {
      title: 'Update on your incident {{refNo}}',
      message: '{{update}}'
    }
  }
};

const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS) as SystemConfigKey[];

interface ConfigRow {
  configKey: string;
  configValue: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

// In-memory cache — config reads happen on hot request paths (SLA calculation)
let cache: SystemConfig | null = null;
let cacheMeta: Record<string, { updatedBy: string | null; updatedAt: string | null }> = {};

const mergeStored = (key: SystemConfigKey, raw: string): SystemConfig[SystemConfigKey] => {
  try {
    const stored = JSON.parse(raw);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...CONFIG_DEFAULTS[key], ...stored };
    }
  } catch {
    // fall through to defaults on corrupt JSON
  }
  return CONFIG_DEFAULTS[key];
};

export const ConfigService = {
  isValidKey(key: string): key is SystemConfigKey {
    return CONFIG_KEYS.includes(key as SystemConfigKey);
  },

  async getAll(): Promise<SystemConfig> {
    if (cache) return cache;
    const merged: SystemConfig = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));
    try {
      const rows = await query<ConfigRow>('SELECT * FROM system_config');
      for (const row of rows) {
        if (this.isValidKey(row.configKey)) {
          (merged as any)[row.configKey] = mergeStored(row.configKey, row.configValue);
          cacheMeta[row.configKey] = { updatedBy: row.updatedBy, updatedAt: row.updatedAt };
        }
      }
    } catch (err) {
      console.error('[ConfigService] Falling back to config defaults:', err);
      return merged; // do not cache a failed read
    }
    cache = merged;
    return merged;
  },

  /** Last-updated metadata per key (empty for keys still on code defaults). */
  getMeta() {
    return cacheMeta;
  },

  async getSlaRules(): Promise<SlaRules> {
    return (await this.getAll()).sla_rules;
  },

  async getEscalationRules(): Promise<EscalationRules> {
    return (await this.getAll()).escalation_rules;
  },

  async getIncidentCategories(): Promise<IncidentCategories> {
    return (await this.getAll()).incident_categories;
  },

  async getNotificationTemplates(): Promise<NotificationTemplates> {
    return (await this.getAll()).notification_templates;
  },

  async update(key: SystemConfigKey, value: object, updatedBy: string): Promise<void> {
    const serialized = JSON.stringify(value);
    const updatedAt = new Date().toISOString();
    const result = await execute(
      'UPDATE system_config SET configValue = ?, updatedBy = ?, updatedAt = ? WHERE configKey = ?',
      [serialized, updatedBy, updatedAt, key]
    );
    if (result.changes === 0) {
      await execute(
        'INSERT INTO system_config (configKey, configValue, updatedBy, updatedAt) VALUES (?, ?, ?, ?)',
        [key, serialized, updatedBy, updatedAt]
      );
    }
    cache = null; // re-read (and re-merge over defaults) on next access
    cacheMeta = {};
  },

  /** Render a notification template, substituting {{placeholder}} variables. */
  renderTemplate(template: NotificationTemplate, vars: Record<string, string | number>): NotificationTemplate {
    const substitute = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
    return { title: substitute(template.title), message: substitute(template.message) };
  }
};
