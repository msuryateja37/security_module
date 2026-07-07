# SIMS — Business Requirements Specification (BRS V1, June 2026)

Source: `docs/Security Management System BRS V1 (2).docx` — the authoritative spec for THIS project (the security_module app).

> Note: sections 1–3.3 of the source document contain boilerplate copied from a land-rights BRS
> (referrals, restitution claims, LCC). Ignore that content — the real scope starts at the SIMS
> executive summary. This file contains only the SIMS-relevant requirements.

## What SIMS is

The **Security Incident Management System (SIMS)** for the Department of Land Reform and Rural Development (DLRRD), Directorate: Security Management Services. It replaces manual email/WhatsApp/Excel-based incident management with a centralised platform for incident reporting, investigation management, workflow automation, SLA monitoring, reporting, and audit trails — across 9 provincial offices and the National Office (Pretoria).

## In scope (Phase 1)

- Security incident reporting and registration; automated incident reference number generation
- Incident routing and workflow automation
- Preliminary and final investigation management
- SLA monitoring, reminders, and escalations
- Case closure and outcome management
- Document and evidence upload
- Email and in-system notifications
- Provincial and national incident registers
- Dashboard reporting and analytics; Excel export and Power BI integration
- Role-based access control (RBAC) and Active Directory SSO
- Audit trail management; mobile-accessible (responsive web, no dedicated app)

## Out of scope (Phase 1)

- Asset Management System (AM8) integration
- National Operations Centre (NOC) operational functionality
- Integration with external government / law-enforcement systems (SAPS data exchange)
- Biometric authentication; GIS mapping / location services

Future phases: AM8 integration, automated SAPS reporting, NOC functionality, GIS incident mapping, AI-assisted incident analysis.

## Roles (stakeholder register)

| Role | System Role | Responsibilities |
|---|---|---|
| Employee (any departmental employee) | Incident Reporter | Capture/submit incidents, upload documents, track own incident status |
| Provincial Coordinator (Security Management Services) | Investigator / Coordinator | Receive assigned incidents, conduct preliminary and final investigations, update records, maintain provincial register, close cases |
| Assistant Coordinator / Principal Security Officer | Investigator | Assist investigations, capture findings |
| Deputy Director: Physical Security (National) | National Security Manager | Monitor incidents nationally, manage escalations, review investigations, maintain national register, generate reports |
| Director: Security | Executive Reviewer | Review trends, monitor compliance, oversight |
| DDG / Director-General | Executive Oversight | Consolidated dashboards and reports |
| System Administrator (ICT/MTS) | Admin | Users, roles, permissions, SLA config, notification templates, escalation rules |

## Functional requirements (all 40)

### 7.1 Incident Registration
- FR-001 (Must): Any authorised employee can log a security incident.
- FR-002 (Must): Unique incident reference number generated on submission.
- FR-003 (Must): Capture date, time, location, incident type, description.
- FR-004 (Should): Supporting documents/evidence upload.
- FR-005 (Should): Auto-populate user info from Active Directory.

### 7.2 Workflow & Routing
- FR-006 (Must): Auto-route incidents to the relevant Provincial Coordinator.
- FR-007 (Must): Simultaneously notify Deputy Director: Physical Security of ALL incidents.
- FR-008 (Must): Notifications via email AND in-system alerts.
- FR-009 (Must): Track incident status through the whole lifecycle.
- FR-010 (Should): Complete history of workflow actions and status changes.

### 7.3 Investigation Management
- FR-011 (Must): Provincial Coordinators conduct preliminary investigations.
- FR-012 (Must): Capture investigation findings and recommendations.
- FR-013 (Should): Authorised users conduct final investigations.
- FR-014 (Must): Upload investigation reports and supporting evidence.
- FR-015 (Should): Escalate incidents for further investigation.

### 7.4 SLA Monitoring & Escalations
- FR-016 (Must): Monitor investigation and response SLAs.
- FR-017 (Should): Automated reminders before SLA deadlines.
- FR-018 (Must): Escalation notifications for overdue incidents.
- FR-019 (Should): SLA status indicators on dashboards (On Track / At Risk / Overdue).
- FR-020 (Must): Record of all SLA breaches and escalations.

### 7.5 Reporting & Dashboards
- FR-026 (Must): Provincial incident registers.
- FR-027 (Must): Consolidated national incident register.
- FR-028 (Should): Monthly, quarterly, annual reports.
- FR-029 (Must): Role-based dashboards with incident statistics and trends.
- FR-030 (Should): Excel export and Power BI integration.

### 7.6 Security & Access Control
- FR-031 (Must): Microsoft Active Directory SSO authentication.
- FR-032 (Must): Enforce RBAC.
- FR-033 (Must): Restrict users to data for their authorised province and role.
- FR-034 (Must): Secure access to incident records and documents.
- FR-035 (Must): Log all user activities for audit.

### 7.7 System Administration
- FR-036 (Must): Manage users and roles.
- FR-037 (Must): Configure SLA rules and escalation matrices.
- FR-038 (Should): Manage notification templates.
- FR-039 (Must): Configure incident categories and system parameters.
- FR-040 (Should): Administrative reporting/monitoring.

## Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Availability | ≥99.5% during business hours (07:00–18:00 SAST, Mon–Fri) |
| NFR-002 | Usability | Modern web browsers, desktop AND mobile, no dedicated app |
| NFR-003 | Performance | Forms load + incident submission ≤5s on 4G |
| NFR-004 | Performance | ≥500 concurrent users |
| NFR-005 | Data retention | Incident records kept ≥10 years (workflow table says archival = 15-year retention) |
| NFR-006 | Notifications | Delivered within 2 minutes of trigger |
| NFR-007 | Security | Complete, immutable audit trail |
| NFR-008/9 | Backup | Daily backups, RPO 24h, RTO 4h |
| NFR-010 | Compatibility | Latest 2 major versions of Chrome, Edge, Firefox, Safari |
| NFR-011 | Hosting | All data in Microsoft Azure **South Africa** data centres |
| NFR-012 | Security | TLS 1.2+ in transit, encryption at rest |
| NFR-013 | Security | RBAC + provincial-level data segregation |
| NFR-014 | Compliance | POPIA + departmental infosec policies |
| NFR-015 | Scalability | Scale without major redesign |

## Target (to-be) workflow

1. Employee logs in via SSO (AD) → submits incident form (web/mobile).
2. System generates unique reference number, timestamps, stores centrally.
3. Auto-routes to Provincial Coordinator + notifies Deputy Director: Physical Security (+ Director/DDG per workflow rules) via email + in-app.
4. Provincial Coordinator reviews/accepts, assigned Security Officer gives immediate response.
5. Preliminary investigation in SIMS; evidence uploaded; status updated (e.g. "Preliminary Submitted").
6. SLA engine: reminders → escalations for overdue → dashboard indicators (On Track / At Risk / Overdue).
7. Complex/high-risk incidents escalate to national level; detailed investigation by National Office.
8. Final review & approval by Director/authorising authority.
9. Case closed with outcome classification (Closed / Recovered / Referred); reporter auto-notified; archived with full audit trail (15-year retention).
10. Reports auto-generated: provincial registers (Excel), national consolidated register, executive dashboards (Power BI).

## Constraints

- Azure cloud only; data in South Africa.
- Auth restricted to AD SSO — no standalone user management.
- **Provincial data strictly segregated — never accessible across provinces** (except national-level roles).
- POPIA + MISS compliance.
- Phase 1 excludes SAPS/AM8/external integrations.
- Notification delivery depends on Microsoft 365 / SMTP.

## Glossary (project-specific)

SIMS = this system. NOC = National Operations Centre (future). CD: SFMS = Chief Directorate: Security and Facilities Management Services. MISS = Minimum Information Security Standards. TRA = Threat and Risk Assessment. AM8 = asset management authorisation form/system. SSA = State Security Agency. SAPS = South African Police Service.

## Named people (from document control)

Prepared by Business Analysis Team; author Simphiwe Nkosi; approvers Sarah Mokae, Olwethu Mbane, Nikitha Reddy (IT & Development Team).
