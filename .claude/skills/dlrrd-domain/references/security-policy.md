# DLRRD Security Policy (Draft, Oct 2025 review)

Source: `docs/Security Policy Review DLRRD 090625(001) 17 OCT 2025.docx` (~100 pages).
Owner: Chief Directorate: Security and Facilities Management Services (CD: SFMS).
Policy custodian contact: Chief Director Mr. Dumisani Lupungela — Dumisani.lupungela@dlrrd.gov.za, (012) 312 8600.
Review cycle: every two years or when necessary. Marked CONFIDENTIAL — do not expose contents outside the department.

This file distils the rules that affect how the SIMS app should behave. For full text, extract the source docx.

## Time-bound rules the system should encode

These deadlines come straight from the policy — use them as SLA defaults and validation anchors:

| Rule | Deadline |
|---|---|
| Report any security incident to the NOC (CD: SFMS) | **Without delay** (immediately) |
| Full incident report submitted | **Within 14 days** of the incident |
| CD: SFMS reports security breaches to the SSA | **Within 48 hours** |
| Internal investigation of a security breach (what/when/where/who/how) | **Within 14 working days** after report |
| Security Committee recommendations reported to DG | Within 10 working days |
| Security status report to Director-General | **Monthly** |
| Report to SSA and SAPS | **Quarterly** |
| Security Committee meetings | Quarterly or as needed |

Also: a **Register of security breaches must be maintained for audit purposes by the SSA and SAPS** — this is exactly what the app's incident register implements.

## Key definitions (use this exact terminology in UI/code)

- **Security breach**: the negligent or intentional transgression of, or failure to comply with, security measures.
- **Threat**: any potential event or act, deliberate or accidental, that could cause injury to persons, compromise information integrity, or cause loss/damage of assets.
- **Risk**: the likelihood of a threat materialising by exploitation of a vulnerability.
- **Vulnerability**: a security deficiency that could permit a threat to materialise.
- **Threat and Risk Assessment (TRA)**: the process determining when to avoid, reduce and accept risk, and how to diminish the potential impact of a threatening event. (The TRA Checklist screen implements TRA audits.)
- **Need-to-know principle**: furnish only the classified information needed for a person to carry out their task — this justifies strict RBAC + provincial data segregation.
- **Vetting/screening institutions**: SAPS, SSA, SA Secret Service, SANDF.
- Classification levels exist up to **Top Secret** (info that could be used by hostile elements to neutralise department/state objectives). Incident `classification` field relates to this scheme.

## Governance structures

- **Director-General**: overall responsibility for security; delegates to CD: SFMS.
- **CD: SFMS**: custodian of the security policy; conducts TRAs; audits compliance; maintains breach register; liaises with SSA/SAPS; convenes the Security Committee.
- **Departmental Security Committee**: compliance with security norms/standards, reviews policy, assists with TRAs, audits, contingency plans, awareness. Representation: Chief Land Claim Commissioner, Rural Development, Land Redistribution & Tenure Reform, Spatial Planning & Land Use Management, Deeds Registration, NGSM, Corporate Support Services.
- **National Security Forum (NSF)**: security managers from all departmental entities; chaired by CD: SFMS; drafts/reviews security policies and directives.

## Policy domains (chapters in the full document)

Introduction · Purpose · Scope of Application · Roles and Responsibilities · Security Governance Structures (Security Committee, NSF) · Physical Security and Special Events · Handling of Received Parcels and Mails · Information Security · ICT Security · Exceptions · Enforcement · Communicating the Policy · Review & Update · Implementation · Monitoring of Compliance · Disciplinary Action.

## Legislative framework (what "compliance" means for this app)

Most relevant to system features:
- **MISS** (Minimum Information Security Standards, 1996) and **MPSS** (Minimum Physical Security Standards, 2009) — the mandate for the whole security function.
- **POPIA** (Act 4 of 2013) — personal data of reporters/subjects must be protected; retention and access controls.
- **National Archives and Record Services Act** (Act 43 of 1996) — electronic record retention (10–15 years for incident records).
- **Cybercrimes Act 19 of 2020**, **Critical Infrastructure Protection Act 2019**, **Electronic Communication and Transaction Act 2002**.
- **PAJA** (Act 3 of 2000) — procedurally fair, documented decision-making → audit trails and notification records are legally significant.
- Also: Control of Access to Public Premises and Vehicles Act, Firearms Control Act, Occupational Health and Safety Act, Prevention and Combating of Corrupt Activities Act, Protected Disclosures Act, National Vetting Strategy 2006.

## Abbreviations used across the department

DG (Director-General) · DDG (Deputy Director-General) · CD: SFMS (Chief Director: Security and Facilities Management Services) · CIO · COMSEC (Electronic Communications Security Pty Ltd) · D: ICT · GITO (Government IT Officers) · ISSS (Information Systems Security Specialist) · SANDF · SAPS · SSA (State Security Agency) · DPCI (Priority Crime Investigations, "Hawks") · SMS (Senior Management Service) · TSCM (Technical Surveillance Counter-Measures) · NOC (National Operations Centre).
