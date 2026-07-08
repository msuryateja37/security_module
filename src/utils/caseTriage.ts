// Case triage engine — suggests whether a case is "Routine" (provincial closure by the
// coordinator) or "Complex/High-Risk" (escalate to National Office), per the BRS target
// workflow: "Complex/high-risk incidents escalate to national level" and FR-015.
//
// Deliberately deterministic (rule-based, not an LLM call): under PAJA the coordinator's
// decision must be documented and defensible, so the suggestion must be reproducible and
// every reason must cite the policy/BRS basis. The verdict is a SUGGESTION only — the
// coordinator makes and records the actual close/escalate decision.

import type { SecurityIncident } from '../types/security';

// Policy knobs (FR-037/FR-039 make categories and escalation matrices admin-configurable;
// wire these to the Administration screen when that config surface is built).
export const LOSS_VALUE_ELEVATED_THRESHOLD = 10_000; // Rand
export const LOSS_VALUE_CRITICAL_THRESHOLD = 50_000; // Rand
const COMPLEX_SCORE_THRESHOLD = 3;

// Incident types from the official NOC Incident Notification Form list that are
// inherently high-risk — threats to life, state security or classified information.
const CRITICAL_INCIDENT_TYPES = new Set([
  'Armed Robbery',
  'Bomb Threat',
  'Kidnapping',
  'Hostage situation',
  'Acts of terrorism/terror',
  'Sabotage',
  'Arson',
  'Explosion',
  'Loss of information'
]);

// Types that raise the risk profile but are not automatically national-level.
const ELEVATED_INCIDENT_TYPES = new Set([
  'Robbery',
  'Fraud',
  'Extortion',
  'Violence (workplace)',
  'Assault',
  'Drugs',
  'Firearm related',
  'Accidental discharge of a firearm',
  'Firearm left unattended'
]);

export type TriageVerdict = 'Routine' | 'Complex/High-Risk';

export interface TriageReason {
  /** 'risk' pushes towards Complex/High-Risk; 'mitigating' supports Routine. */
  kind: 'risk' | 'mitigating';
  factor: string;
  detail: string;
  /** The requirement/policy the reason traces back to. */
  basis?: string;
}

export interface TriageResult {
  verdict: TriageVerdict;
  score: number;
  reasons: TriageReason[];
  /** What the coordinator should do with the case, in BRS terms. */
  recommendation: string;
}

const NO_INJURY_PATTERN = /^(|none|nil|no|n\/a|na|-|nothing|none reported|no injuries( or fatalities)?)$/i;

const formatRand = (value: number) => `R ${value.toLocaleString('en-ZA')}`;

export const triageCase = (incident: SecurityIncident): TriageResult => {
  const reasons: TriageReason[] = [];
  let score = 0;

  // 1. Incident type (official NOC form list)
  const criticalTypes = (incident.incidentType || []).filter(t => CRITICAL_INCIDENT_TYPES.has(t));
  const elevatedTypes = (incident.incidentType || []).filter(t => ELEVATED_INCIDENT_TYPES.has(t));
  if (criticalTypes.length > 0) {
    score += 3;
    reasons.push({
      kind: 'risk',
      factor: 'High-risk incident type',
      detail: `"${criticalTypes.join('", "')}" ${criticalTypes.length > 1 ? 'are' : 'is a'} high-risk incident type${criticalTypes.length > 1 ? 's' : ''} (threat to life, state security or departmental information).`,
      basis: 'BRS target workflow: complex/high-risk incidents escalate to national level'
    });
  } else if (elevatedTypes.length > 0) {
    score += 1;
    reasons.push({
      kind: 'risk',
      factor: 'Elevated incident type',
      detail: `"${elevatedTypes.join('", "')}" raises the risk profile of this case.`,
      basis: 'Official NOC incident-type list'
    });
  } else {
    reasons.push({
      kind: 'mitigating',
      factor: 'Incident type',
      detail: 'The reported incident type(s) are routine categories normally handled at provincial level.'
    });
  }

  // 2. Injuries or fatalities (NOC form field)
  const injuries = (incident.injuriesFatalities || '').trim();
  if (!NO_INJURY_PATTERN.test(injuries)) {
    score += 3;
    reasons.push({
      kind: 'risk',
      factor: 'Injuries or fatalities',
      detail: `The report records injuries/fatalities: "${injuries}". A case involving harm to persons is never routine.`,
      basis: 'NOC Incident Notification Form — Injuries or Fatalities field'
    });
  } else {
    reasons.push({
      kind: 'mitigating',
      factor: 'Injuries or fatalities',
      detail: 'No injuries or fatalities reported.'
    });
  }

  // 3. Value of loss (register column; thresholds are policy knobs, FR-039)
  const loss = incident.lossValue || 0;
  if (loss >= LOSS_VALUE_CRITICAL_THRESHOLD) {
    score += 3;
    reasons.push({
      kind: 'risk',
      factor: 'Major financial loss',
      detail: `Loss to the Department of ${formatRand(loss)} is at or above the critical threshold of ${formatRand(LOSS_VALUE_CRITICAL_THRESHOLD)}.`,
      basis: 'Security Breaches Register — Value of loss'
    });
  } else if (loss >= LOSS_VALUE_ELEVATED_THRESHOLD) {
    score += 2;
    reasons.push({
      kind: 'risk',
      factor: 'Significant financial loss',
      detail: `Loss of ${formatRand(loss)} exceeds the ${formatRand(LOSS_VALUE_ELEVATED_THRESHOLD)} provincial threshold.`,
      basis: 'Security Breaches Register — Value of loss'
    });
  } else {
    reasons.push({
      kind: 'mitigating',
      factor: 'Value of loss',
      detail: `Loss of ${formatRand(loss)} is below the ${formatRand(LOSS_VALUE_ELEVATED_THRESHOLD)} threshold.`
    });
  }

  // 4. Security classification (MISS scheme; classified breaches → SSA within 48h)
  if (incident.classification === 'Secret' || incident.classification === 'Top Secret') {
    score += 3;
    reasons.push({
      kind: 'risk',
      factor: `${incident.classification} classification`,
      detail: `A ${incident.classification} case involves classified information — a breach must be reported to the SSA within 48 hours and cannot be closed quietly at provincial level.`,
      basis: 'Security Policy: CD: SFMS reports breaches to the SSA within 48 hours (MISS)'
    });
  } else if (incident.classification === 'Confidential') {
    score += 2;
    reasons.push({
      kind: 'risk',
      factor: 'Confidential classification',
      detail: 'Confidential material is involved; the 48-hour SSA breach-reporting rule may apply.',
      basis: 'Security Policy: 48-hour SSA reporting (MISS)'
    });
  } else {
    reasons.push({
      kind: 'mitigating',
      factor: 'Classification',
      detail: `Classified as ${incident.classification} — no classified-information handling rules are triggered.`
    });
  }

  // 5. SAPS / SSA involvement (criminal matter)
  const sapsInvolved = incident.reportedToSapsSsa === 'Yes' || !!incident.sapsCaseNumber || (incident.arrests || 0) > 0;
  if (sapsInvolved) {
    score += 2;
    const parts = [
      incident.reportedToSapsSsa === 'Yes' ? 'reported to SAPS/SSA' : '',
      incident.sapsCaseNumber ? `CAS number ${incident.sapsCaseNumber}` : '',
      (incident.arrests || 0) > 0 ? `${incident.arrests} arrest(s) made` : ''
    ].filter(Boolean).join(', ');
    reasons.push({
      kind: 'risk',
      factor: 'Criminal matter',
      detail: `Police are involved (${parts}) — the case runs alongside a criminal process and needs executive visibility.`,
      basis: 'NOC form — SAPS case number / arrests; quarterly SSA & SAPS reporting'
    });
  } else {
    reasons.push({
      kind: 'mitigating',
      factor: 'SAPS / SSA',
      detail: 'Not reported to SAPS/SSA and no arrests — no parallel criminal process.'
    });
  }

  // 6. SLA position (FR-016–FR-020; investigation due within 14 working days)
  if (incident.slaInfo && incident.status !== 'Closed') {
    if (incident.slaInfo.daysRemaining < 0) {
      score += 2;
      reasons.push({
        kind: 'risk',
        factor: 'Investigation overdue',
        detail: `The ${incident.slaInfo.targetDays}-working-day investigation deadline passed ${-incident.slaInfo.daysRemaining} working day(s) ago — overdue incidents trigger escalation.`,
        basis: 'FR-018 escalation for overdue incidents; Security Policy 14-working-day investigation'
      });
    } else if (incident.slaInfo.status === 'At Risk') {
      score += 1;
      reasons.push({
        kind: 'risk',
        factor: 'SLA at risk',
        detail: `Only ${incident.slaInfo.daysRemaining} working day(s) remain of the ${incident.slaInfo.targetDays}-day investigation window.`,
        basis: 'FR-019 SLA indicators (On Track / At Risk / Overdue)'
      });
    } else {
      reasons.push({
        kind: 'mitigating',
        factor: 'SLA',
        detail: `Investigation is on track (day ${incident.slaInfo.daysElapsed} of ${incident.slaInfo.targetDays}).`
      });
    }
  }

  // 7. Already escalated — the decision has effectively been taken
  if (incident.isEscalated) {
    score += 3;
    reasons.push({
      kind: 'risk',
      factor: 'Already escalated',
      detail: `This case has already been escalated${incident.escalationLevel ? ` (${incident.escalationLevel})` : ''}${incident.escalatedTo ? ` to ${incident.escalatedTo}` : ''}.`
    });
  }

  const verdict: TriageVerdict = score >= COMPLEX_SCORE_THRESHOLD ? 'Complex/High-Risk' : 'Routine';

  const recommendation = verdict === 'Routine'
    ? 'Eligible for provincial handling: the coordinator may conduct the preliminary investigation and close the case with an investigation report and supporting evidence attached (FR-011/FR-012/FR-014).'
    : incident.isEscalated
      ? 'This case is already on the national escalation path — continue the detailed investigation and keep the National Office informed.'
      : 'Recommend escalation for national-level investigation (BRS workflow: complex/high-risk incidents escalate to the National Office). Closure will require Director approval.';

  return { verdict, score, reasons, recommendation };
};
