---
name: dlrrd-domain
description: Authoritative DLRRD business/domain knowledge for this workspace — the SIMS security module (BRS requirements, roles, SLA rules, official incident types, register columns, performance indicators, security policy deadlines) and the separate Municipal Services Payment System BRS. ALWAYS consult this skill before implementing a new feature, updating an existing screen/form/workflow, changing the database schema, adding roles/permissions, building reports or dashboards, or answering questions about requirements, compliance (POPIA/MISS/PFMA), provinces, incident types, SLAs, or department terminology — even if the user doesn't mention "requirements" or "BRS". The source .docx/.xlsx files in docs/ are binary; these references are the readable extraction of them.
---

# DLRRD Domain Knowledge

This workspace implements systems for the **Department of Land Reform and Rural Development (DLRRD)**, South Africa. The primary app in this repo is **SIMS — the Security Incident Management System** (the "security module") for the Chief Directorate: Security and Facilities Management Services (CD: SFMS). A second, separate system (Municipal Services Payment Processing) is documented here because it belongs to the same client.

Features must trace back to the BRS. When a user asks for a feature, find the matching FR/NFR and honour its wording, priorities and constraints; when the BRS is silent, follow the official paper forms and the security policy — users are government officials who know these documents by heart, so terminology mismatches read as bugs.

## Non-negotiable constraints (apply to every SIMS feature)

- **Provincial data segregation**: users see only their authorised province's data; national roles (Deputy Director: Physical Security, Director, DDG/DG) see all. Never leak data across provinces (FR-033, NFR-013).
- **Auth is Active Directory SSO only** — no standalone user accounts (FR-031, BRS constraint).
- **Every action is audited**: immutable audit trail, legally significant under PAJA (FR-035, NFR-007).
- **POPIA**: incident records contain personal data; retention ≥10 years (archival 15), access on need-to-know.
- **Hosting**: Azure, South Africa data centres only.
- The 9 provinces (canonical names): Gauteng, North West, Free State, Limpopo, Mpumalanga, KwaZulu Natal, Western Cape, Eastern Cape, Northern Cape. Financial year runs **April–March**; monthly stats and registers follow it.
- SLA defaults from policy: report incident to NOC **immediately**; full report **≤14 days**; breach to SSA **≤48h**; internal investigation **≤14 working days**; notifications delivered **≤2 min**.

## References — read the one that matches the work

| Working on… | Read |
|---|---|
| Any SIMS feature, workflow, role, SLA, dashboard, admin, NFR question | [references/sims-brs.md](references/sims-brs.md) |
| Incident form fields, incident-type list, register/export columns, performance indicators, the 5 screens, investigation report structure | [references/forms-and-registers.md](references/forms-and-registers.md) |
| Compliance, classifications, deadlines, governance, terminology/definitions, legislation | [references/security-policy.md](references/security-policy.md) |
| The Municipal Services **Payment** system (separate app: invoices, PFMA approval chain, payment vault) | [references/municipal-payment-brs.md](references/municipal-payment-brs.md) |

For pixel-level screen layouts, the source `docs/DLRRD - SECURITY SCREENS.docx` contains screenshots (images — not extractable to text).

## How domain maps to this codebase

- Types: `src/types/security.ts` · DB schema: `database.sql` (SQLite) / `database_mssql.sql` (Azure SQL) · server: `server/` (controllers/models/routes)
- Screens ↔ official forms: `ReportIncidentView` (NOC notification form) · `RegisterView` (breaches register) · `InvestigationReportView` · `MonthlyStatsView` (12 indicators × Apr–Mar) · `MonthlyQuarterlyReportView` · `TraChecklistView` (TRA audits) · `BackToOfficeView` · `SlaMonitorView` · `ApprovalView` · `AdministrationView`
- Incident lifecycle: reported → routed to Provincial Coordinator (+ Deputy Director notified) → preliminary investigation → (escalation) → final investigation → director approval → closure (Closed / Recovered / Referred) → archive.

## Cross-cutting cautions

- **Role rename (July 2026, client instruction):** the role the BRS/docs call "Security Director" or "Chief Director" (internal key `security_director`) is now displayed as **"Chief Security Director"** everywhere in the app. The reference docs predate the rename — keep their requirements but use the new name in UI, notifications, and reports.

- The SIMS BRS document's opening sections contain copy-pasted land-rights/restitution text — it is boilerplate; ignore it (details in sims-brs.md).
- Empty register values are shown as "Nil"/"N/A", not blank — matches the official xlsx.
- Incident `classification` relates to the government classification scheme (up to Top Secret); treat classified fields conservatively in logs and exports.
- Both systems' docs are marked CONFIDENTIAL — don't paste their contents into external services, issues, or commits beyond this private repo.
