import { Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionFunctionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { IncidentModel } from '../models/incident.model.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { AuditService } from '../security/audit.service.js';
import { SlaService } from '../security/sla.service.js';
import { UserProfile } from '../security/roleAccess.js';

/**
 * SIMS Assistant — conversational AI over Azure OpenAI.
 *
 * The model NEVER touches the database. It can only request the tools below;
 * this controller executes them with the authenticated user's permissions
 * (provincial segregation, FR-033) and returns the results to the model.
 * Form pre-fills are returned to the client as a draft — the user reviews
 * and submits through the normal form, so the audit trail records the human
 * as the author of the incident (PAJA).
 */

const PROVINCES = [
  'Gauteng', 'North West', 'Free State', 'Limpopo', 'Mpumalanga',
  'KwaZulu Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape'
];

// Must match INCIDENT_TYPES_LIST in ReportIncidentView.tsx (official notification form)
const INCIDENT_TYPES = [
  'Loss of information', 'Armed Robbery', 'Violence (workplace)', 'Conflict of interest',
  'Malicious damage to property', 'Trespassing', 'Bomb Threat', 'Robbery', 'Fraud',
  'Extortion', 'Sabotage', 'Drugs', 'Harassment', 'Assault', 'Theft', 'Kidnapping',
  'Arson', 'Pouching', 'Accidental Discharge of a firearm', 'Acts of terrorism / terror',
  'Violation of permit system', 'Fire', 'Explosion', 'Hostage situation', 'Firearm related',
  'Permit related', 'Firearm left unattended', 'Accidental damage to property'
];

let aiClient: OpenAI | null = null;

function getAiClient(): OpenAI {
  if (aiClient) return aiClient;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error('Assistant is not configured: AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY missing');
  }
  aiClient = new OpenAI({ baseURL: endpoint.replace(/\/?$/, '/'), apiKey });
  return aiClient;
}

/** Provincial data segregation — mirrors IncidentController.getAll (FR-033). */
function scopeIncidentsForUser(incidents: any[], user: UserProfile): any[] {
  if (user.role === 'security_coordinator') {
    return incidents.filter(i => i.province === user.province || i.province === 'National');
  }
  if (user.role === 'employee') {
    return incidents.filter(i =>
      i.ownerId === user.username || i.reportedBy === user.displayName || i.contactDetails === user.email
    );
  }
  if (user.role === 'chief_security_investigator') {
    // Chief Investigator only sees cases assigned to them by the Security Director
    return incidents.filter(i => i.responsiblePerson === user.displayName);
  }
  return incidents; // Chief Director sees all
}

/** Compact projection so we don't send full narratives to the model for a list. */
function toSummary(inc: any) {
  return {
    id: inc.id,
    refNo: inc.refNo,
    status: inc.status,
    incidentType: inc.incidentType,
    place: inc.place,
    province: inc.province,
    dateReported: inc.dateReported,
    natureOfLoss: inc.natureOfLoss,
    lossValue: inc.lossValue,
    responsiblePerson: inc.responsiblePerson,
    slaStatus: SlaService.calculateSla(inc)?.status ?? undefined
  };
}

const ALL_TOOLS: ChatCompletionFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_my_incidents',
      description:
        'List the security incidents the current user is authorised to see (already scoped to their role and province). ' +
        'Use when the user asks for their reports/incidents/cases or an overview of them.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['Open', 'Under Investigation', 'SAPS Case', 'Closed'],
            description: 'Optional status filter'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_incident_details',
      description:
        'Get the full details of one incident by its reference number (e.g. SEC/2026/1234). ' +
        'Use when the user asks about a specific incident or wants an overview/summary of it.',
      parameters: {
        type: 'object',
        properties: {
          refNo: { type: 'string', description: 'The incident reference number' }
        },
        required: ['refNo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_case',
      description:
        'Analyse one case and return everything needed for a structured management brief: full details, ' +
        'SLA position, escalation state, and who raised the case with their contact information. ' +
        'Use when a Coordinator, Chief Investigator or Chief Director asks to analyse, brief, or review a case. ' +
        'Present the result as a structured brief: Summary, Key Facts, Reporter & Contact, Status & SLA, Recommended Next Step.',
      parameters: {
        type: 'object',
        properties: {
          refNo: { type: 'string', description: 'The incident reference number, e.g. SEC/2026/1234' }
        },
        required: ['refNo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_case_statistics',
      description:
        'Get case-load statistics for the user\'s scope: total cases, new/open cases, cases attended by the user, ' +
        'unassigned cases, breakdown by status and by SLA position (and by province for the Chief Director). ' +
        'Use when the user asks how many cases they have, what is new, their workload, or a province overview.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_my_profile',
      description:
        'Get the current user\'s own profile: display name, role, province, office, email and security clearance. ' +
        'Use when the user asks about their own account, role, access level or province.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'prefill_incident_form',
      description:
        'Prepare a draft of the incident notification form from details the user has described. ' +
        'Call this ONLY after you have gathered at least: what happened, date/time, place, and incident type(s). ' +
        'Ask the user for missing required details first, one or two questions at a time. ' +
        'The draft is shown to the user for review — it is never submitted automatically.',
      parameters: {
        type: 'object',
        properties: {
          dateTime: { type: 'string', description: 'Date and time of occurrence, ISO format (YYYY-MM-DDTHH:MM)' },
          place: { type: 'string', description: 'Place of occurrence (building/office/site)' },
          province: { type: 'string', enum: PROVINCES },
          incidentType: {
            type: 'array',
            items: { type: 'string', enum: INCIDENT_TYPES },
            description: 'All applicable incident types from the official list'
          },
          otherIncidentTypeDetails: { type: 'string', description: 'Elaboration when no official type fits' },
          lossValue: { type: 'number', description: 'Loss to the Department in Rand (0 if none)' },
          natureOfLoss: { type: 'string', description: 'Nature of loss/damage, e.g. "2x laptops", "None"' },
          injuriesFatalities: { type: 'string', description: 'Injuries or fatalities, or "None"' },
          sapsCaseNumber: { type: 'string', description: 'SAPS CAS number if police were involved' },
          policeStation: { type: 'string', description: 'Police station where the case was opened' },
          reportedToSapsSsa: { type: 'string', enum: ['Yes', 'No', 'Pending'] },
          classification: {
            type: 'string',
            enum: ['Unclassified', 'Restricted', 'Confidential', 'Secret', 'Top Secret']
          },
          whatHappened: { type: 'string', description: 'Narrative: what happened' },
          whereHappened: { type: 'string', description: 'Narrative: where exactly it happened' },
          howHappened: { type: 'string', description: 'Narrative: how it happened' },
          whoResponsible: { type: 'string', description: 'Who is (suspected to be) responsible, if known' },
          weaponsUsed: { type: 'string', description: 'Weapons used, if any' },
          damageDone: { type: 'string', description: 'Damage done' },
          actionTaken: { type: 'string', description: 'Immediate action taken so far' }
        },
        required: ['dateTime', 'place', 'incidentType', 'whatHappened']
      }
    }
  }
];

/**
 * Role-aware tool exposure (client responsibility matrix):
 * - Employee: register incident via chat, track own incidents, basic questions, own profile.
 * - Security Coordinator: + case analysis/brief, province case-load statistics, reporter contact info.
 * - Chief Investigator: assigned-case tracking, analysis of assigned cases, statistics; no form pre-fill.
 * - Chief Director: all-province oversight, analysis, statistics; no form pre-fill.
 */
function getToolsForUser(user: UserProfile): ChatCompletionFunctionTool[] {
  const managementRoles = ['security_coordinator', 'chief_security_investigator', 'security_director'];
  return ALL_TOOLS.filter(tool => {
    const name = tool.function.name;
    if (name === 'prefill_incident_form') return user.role === 'employee' || user.role === 'security_coordinator';
    if (name === 'analyze_case' || name === 'get_case_statistics') return managementRoles.includes(user.role);
    return true;
  });
}

// AI capabilities per role — mirrors the client responsibility matrix exactly.
const ROLE_AI_CAPABILITIES: Record<string, string[]> = {
  employee: [
    'Register an incident via chat: the user describes what happened, you ask short follow-up questions for missing required details (date/time, place, incident types, loss, SAPS involvement), then call prefill_incident_form. Tell the user a draft has been prepared for their review — you never submit it yourself.',
    'Track incident status: use list_my_incidents / get_incident_details for the user\'s own submissions.',
    'Answer basic questions about incidents and the reporting process.',
    'Answer questions about the user\'s own profile (get_my_profile).'
  ],
  security_coordinator: [
    'Analyse a case and provide a brief (analyze_case): present as a structured brief — Summary, Key Facts, Reporter & Contact, Status & SLA, Recommended Next Step. For the next step apply the workflow: a small/simple case can be closed by the Coordinator once complete with reports and attachments; a significant/big case must be escalated to the Security Director, who assigns the Chief Investigator.',
    'Dashboard numbers (get_case_statistics): cases in the coordinator\'s province, cases attended by them, new cases, SLA position.',
    'When asked who raised a case or how to contact the reporter, give the reporter\'s name and contact details from the case record — coordinators are authorised to contact the employee.',
    'Register an incident via chat (prefill_incident_form) and track cases (list_my_incidents / get_incident_details).',
    'Answer questions about the user\'s own profile (get_my_profile).'
  ],
  chief_security_investigator: [
    'Track and analyse assigned cases only — cases the Security Director has assigned to this investigator (list_my_incidents / get_incident_details / analyze_case).',
    'Case briefs (analyze_case): Summary, Key Facts, Reporter & Contact, Status & SLA, Recommended Next Step. The investigator\'s workflow: collect field information/data, attach it to the case (Investigation view), then move the case to approval for the Security Director; the cycle repeats until the Director approves closure.',
    'Workload numbers (get_case_statistics).',
    'Answer questions about the user\'s own profile (get_my_profile). Note: investigators do not register incidents via chat.'
  ],
  security_director: [
    'Oversight of all provinces: list, analyse and brief any case (list_my_incidents / get_incident_details / analyze_case), and per-province statistics (get_case_statistics).',
    'Case briefs (analyze_case): Summary, Key Facts, Reporter & Contact, Status & SLA, Recommended Next Step. The Director\'s workflow: assign the Chief Investigator to escalated cases (My Cases → set responsible person), review investigation submissions, and approve final closure.',
    'If asked about coordinator leave cover: the Director appoints a temporary Security Coordinator in Administration → Users & Acting Roles; the acting coordinator has the full rights of a permanent one.',
    'Answer questions about the user\'s own profile (get_my_profile). Note: the Director does not register incidents via chat.'
  ]
};

function buildSystemPrompt(user: UserProfile): string {
  const capabilities = ROLE_AI_CAPABILITIES[user.role] || ROLE_AI_CAPABILITIES.employee;
  return [
    'You are the AI Assistant for the Security Incident Management System of the Department of Land Reform and Rural Development (DLRRD), South Africa.',
    '',
    `Current user: ${user.displayName} (${user.roleLabel}, province: ${user.province}).`,
    '',
    `What you can do for this user (${user.roleLabel}):`,
    ...capabilities.map((c, i) => `${i + 1}. ${c}`),
    '',
    'Process facts you may state:',
    '   - Roles: Employees report and track their own incidents. Security Coordinators approve cases, close small cases with reports/attachments, and escalate significant cases to the Security Director. The Chief Investigator only works cases assigned by the Security Director, collects field data, and submits the case for the Director\'s approval. The Chief Director (Security Director) oversees all provinces, assigns investigators, approves closures, and can appoint an employee as temporary Security Coordinator (e.g. leave cover).',
    '   - SLA/policy deadlines: report incident to NOC immediately/without delay; full report within 14 days; security breach to SSA within 48 hours; internal investigation within 14 working days.',
    '   - Escalation: coordinators escalate complex cases (Major, High Risk, Critical, National Review) from My Cases; escalations go to the Security Director.',
    '   - Incidents are submitted via Submit Reports → Incident Notification; the system generates the reference number and notifies the Security Coordinator automatically.',
    '',
    'Rules:',
    '- Data access is enforced by the server, scoped to the user\'s role and province. Never speculate about records outside the tool results; if a lookup returns nothing, say the record does not exist in their authorised scope.',
    '- Never invent reference numbers, statuses, or statistics. Only state what tool results contain.',
    '- Do not reveal personal information beyond what the tools return.',
    '- If asked something unrelated to SIMS or security incident management, politely decline.',
    '- Dates: South African financial year runs April to March. Use en-ZA conventions.',
    '- Be concise and professional. Use short paragraphs or bullet lists.',
    `- Today's date is ${new Date().toISOString().slice(0, 10)}.`
  ].join('\n');
}

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AssistantController = {
  async chat(req: AuthenticatedRequest, res: Response) {
    const user = req.user!;
    try {
      const history: ClientMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
      if (history.length === 0 || history[history.length - 1].role !== 'user') {
        return ResponseView.sendError(res, 'Last message must be from the user', 'Validation failed', 400);
      }
      // Bound conversation size (cost + context control)
      const trimmed = history.slice(-20).map(m => ({
        role: m.role,
        content: String(m.content).slice(0, 4000)
      }));

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: buildSystemPrompt(user) },
        ...trimmed
      ];

      const client = getAiClient();
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
      const tools = getToolsForUser(user);

      // Side effects gathered from tool calls, returned to the UI
      let incidentCards: any[] | undefined;
      let formDraft: Record<string, any> | undefined;

      let reply = '';
      for (let turn = 0; turn < 6; turn++) {
        const completion = await client.chat.completions.create({
          model: deployment,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 900
        });

        const choice = completion.choices[0].message;

        if (!choice.tool_calls || choice.tool_calls.length === 0) {
          reply = choice.content || '';
          break;
        }

        messages.push(choice);

        for (const call of choice.tool_calls) {
          if (call.type !== 'function') continue;
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* leave empty */ }
          let result: any;

          if (call.function.name === 'list_my_incidents') {
            const all = await IncidentModel.getAll();
            let scoped = scopeIncidentsForUser(all, user);
            if (args.status) scoped = scoped.filter(i => i.status === args.status);
            const summaries = scoped.map(toSummary);
            incidentCards = summaries.slice(0, 5);
            result = { count: summaries.length, incidents: summaries.slice(0, 25) };
          } else if (call.function.name === 'get_incident_details') {
            const all = await IncidentModel.getAll();
            const scoped = scopeIncidentsForUser(all, user);
            const found = scoped.find(
              i => i.refNo?.toLowerCase() === String(args.refNo || '').toLowerCase()
            );
            if (found) {
              incidentCards = [toSummary(found)];
              result = { ...found, slaInfo: SlaService.calculateSla(found) };
            } else {
              result = { error: 'Not found in the records this user is authorised to view.' };
            }
          } else if (call.function.name === 'analyze_case') {
            const all = await IncidentModel.getAll();
            const scoped = scopeIncidentsForUser(all, user);
            const found = scoped.find(
              i => i.refNo?.toLowerCase() === String(args.refNo || '').toLowerCase()
            );
            if (found) {
              incidentCards = [toSummary(found)];
              result = {
                case: found,
                slaInfo: SlaService.calculateSla(found),
                reporter: {
                  raisedBy: found.reportedBy,
                  contactDetails: found.contactDetails,
                  note: 'The coordinator may contact this employee directly about the case.'
                },
                escalation: found.isEscalated
                  ? {
                      level: found.escalationLevel,
                      reason: found.escalationReason,
                      escalatedBy: found.escalatedBy,
                      escalatedTo: found.escalatedTo,
                      escalatedAt: found.escalatedAt
                    }
                  : null
              };
            } else {
              result = { error: 'Not found in the records this user is authorised to view.' };
            }
          } else if (call.function.name === 'get_case_statistics') {
            const all = await IncidentModel.getAll();
            const scoped = scopeIncidentsForUser(all, user);
            const byStatus: Record<string, number> = {};
            const bySla: Record<string, number> = { 'On Track': 0, 'At Risk': 0, 'Overdue': 0 };
            const byProvince: Record<string, number> = {};
            let attendedByMe = 0;
            let unassigned = 0;
            for (const inc of scoped) {
              byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
              const sla = SlaService.calculateSla(inc);
              if (sla?.status) bySla[sla.status] = (bySla[sla.status] || 0) + 1;
              byProvince[inc.province] = (byProvince[inc.province] || 0) + 1;
              if (inc.responsiblePerson === user.displayName) attendedByMe++;
              if (!inc.responsiblePerson || inc.responsiblePerson === 'Unassigned') unassigned++;
            }
            result = {
              scope:
                user.role === 'security_director' ? 'all provinces'
                : user.role === 'security_coordinator' ? `province: ${user.province}`
                : user.role === 'chief_security_investigator' ? 'cases assigned to me'
                : 'own submissions',
              totalCases: scoped.length,
              newCases: byStatus['Open'] || 0,
              attendedByMe,
              unassigned,
              byStatus,
              bySla,
              ...(user.role === 'security_director' ? { byProvince } : {})
            };
          } else if (call.function.name === 'get_my_profile') {
            result = {
              displayName: user.displayName,
              username: user.username,
              email: user.email,
              role: user.roleLabel,
              province: user.province,
              office: user.office,
              clearanceLevel: user.clearanceLevel,
              actingAssignment: user.baseRole
                ? `Temporary Security Coordinator (permanent role: ${user.baseRole}, assigned by ${user.tempAssignedBy})`
                : null
            };
          } else if (call.function.name === 'prefill_incident_form') {
            // Employees may only draft for their own province
            if (args.province && !PROVINCES.includes(args.province)) delete args.province;
            if (!args.province) args.province = user.province;
            formDraft = args;
            result = { ok: true, note: 'Draft prepared. Tell the user to review it and open it in the incident form — it has NOT been submitted.' };
          } else {
            result = { error: `Unknown tool: ${call.function.name}` };
          }

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        }
      }

      const lastUserMessage = trimmed[trimmed.length - 1].content;
      await AuditService.log({
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username,
        userRole: user.role,
        province: user.province,
        action: 'ASSISTANT_QUERY',
        resource: 'SIMS Assistant',
        details: `Q: "${lastUserMessage.slice(0, 200)}"${formDraft ? ' [form draft prepared]' : ''}${incidentCards ? ` [${incidentCards.length} record(s) returned]` : ''}`,
        clearanceLevel: user.clearanceLevel
      });

      ResponseView.sendSuccess(res, {
        reply: reply || 'I could not complete that request. Please try rephrasing.',
        incidents: incidentCards,
        formDraft
      }, 'Assistant reply generated');
    } catch (error: any) {
      console.error('Assistant error:', error?.message || error);
      ResponseView.sendError(res, error as any, 'Assistant is unavailable right now');
    }
  }
};
