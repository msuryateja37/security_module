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
  /** Hours a Submitted incident may stay unassigned before the assignment SLA breaches. */
  assignmentSlaHours?: number;
  /** Hours after report at which the national roles are pre-warned that a Submitted incident is still unassigned (before the assignment breach). */
  assignmentWarningHours?: number;
  /** Days a coordinator has to complete the preliminary investigation after being assigned a case. */
  coordinatorInvestigationDays?: number;
  /** Days after assignment at which the directors are pre-warned of a possible breach when the coordinator has captured no findings or documents yet. */
  coordinatorWarningDays?: number;
  /** Maximum working days that may be granted per investigation time-extension request. */
  maxExtensionDays?: number;
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
    investigationWorkingDays: 14,
    assignmentSlaHours: 24,
    assignmentWarningHours: 18,
    coordinatorInvestigationDays: 7,
    coordinatorWarningDays: 6,
    maxExtensionDays: 2
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
    coordinator_assigned: {
      title: 'Incident {{refNo}} assigned to you',
      message: '{{assignedBy}} assigned incident {{refNo}} ({{province}}) to you for preliminary review. Please accept the case and begin your assessment.'
    },
    assignment_sla_breach: {
      title: 'SLA breach — {{refNo}} unassigned after {{hours}}h',
      message: 'Incident {{refNo}} ({{province}}, {{classification}}) was reported on {{reportedAt}} and has not been assigned to a coordinator within {{hours}} hours. The assignment SLA has breached. Open the case to assign a coordinator.'
    },
    // Pre-breach warning to the Chief Security Director + Deputy Director while a
    // Submitted incident is still unassigned and approaching its assignment deadline.
    assignment_sla_warning: {
      title: 'Assignment SLA warning — {{refNo}} still unassigned',
      message: 'Incident {{refNo}} ({{province}}, {{classification}}) was reported on {{reportedAt}} and is still not assigned to a coordinator. The {{slaHours}}h assignment SLA breaches in about {{hoursToBreach}}h. Please open the case and assign a coordinator before it breaches.'
    },
    // Pre-breach warning to the Chief Security Director + Deputy Director when a
    // coordinator has captured no preliminary findings/documents by the warning day
    coordinator_prebreach_warning: {
      title: 'Possible SLA breach — {{refNo}} has no findings yet',
      message: '{{coordinator}} was assigned incident {{refNo}} ({{province}}) on {{assignedAt}} and, {{elapsedDays}} days later, has not captured any preliminary findings or uploaded any documents to the case file. The {{investigationDays}}-day preliminary-investigation deadline is approaching — there is a risk of an SLA breach. Please follow up with the coordinator.'
    },
    // Investigation time-extension request (coordinator's 7-day / investigator's 14-day
    // window is at risk or overdue) — sent to the Chief Security Director + Deputy Director,
    // who approve or deny with a message back to the requester.
    extension_requested: {
      title: 'Extension requested — {{refNo}} ({{days}} day{{daysPlural}})',
      message: '{{requestedBy}} ({{requesterRole}}) requested a {{days}}-working-day extension on case {{refNo}} ({{province}}). Reason: {{reason}}. Open the case file to approve or deny the request.'
    },
    // Decision on an extension request — sent to the coordinator/investigator who asked.
    extension_decided: {
      title: 'Extension {{decision}} — {{refNo}}',
      message: '{{decidedBy}} {{decision}} your {{days}}-working-day extension request on case {{refNo}}.{{noteSuffix}}'
    },
    investigation_submitted: {
      title: 'Investigation for {{refNo}} awaiting approval',
      message: '{{investigator}} submitted field investigation findings for case {{refNo}}. Please review and approve or return the investigation.'
    },
    // Deputy Director review chain (v2 user journeys)
    dd_review_required: {
      title: 'Case {{refNo}} awaits your review',
      message: '{{submittedBy}} submitted case {{refNo}} ({{province}}) for Deputy Director verification — requested {{requestedOutcome}}. Please review the case file, add your formal recommendations and forward it to the Chief Security Director.'
    },
    dd_recommendation_submitted: {
      title: 'DD recommendation on {{refNo}} — {{recommendedAction}}',
      message: 'Deputy Director {{deputyDirector}} verified case {{refNo}} ({{province}}) and recommends {{recommendedAction}}. The case awaits your approval decision.'
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
