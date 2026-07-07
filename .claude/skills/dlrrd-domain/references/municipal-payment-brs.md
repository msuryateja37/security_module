# Municipal Services Payment Processing System — BRS (May 2026)

Source: `docs/BRS_Municipal_Services_Payment_System_Updated (1).docx`. Classification: CONFIDENTIAL.

> **This is a SEPARATE application, not the security module.** Owner: Directorate: Facilities
> Management Services (same department, DLRRD). Its own BRS lists "physical security case
> management" as out-of-scope/"separate application" — that separate application is SIMS.
> Read this file only when working on the payment system or when a feature spans both
> (shared AD SSO patterns, notification patterns, audit-trail patterns, document vault ideas).

## What it is

Digitises the manual sundry-payment workflow for municipal service invoices (municipalities, Eskom, landlords) — from invoice receipt at a centralised email inbox through AI data extraction, compilation, multi-level approval, Internal Control quality check, payment confirmation, and 15-year archival. Enforces the **PFMA 30-day payment rule**. ~60,000+ documents annually.

## PFMA role separation (mandatory — the system must not allow bypass)

| PFMA role | Who | What |
|---|---|---|
| **Compiler** | Supervisor (SAO/ASD) + Admin Clerk (AC/SAC) | Prepares the payment batch |
| **Checker** | Deputy Director (or delegated official — not strictly level-based) | Verifies batch correctness |
| **Authoriser / Responsibility Manager** | **Director only** | Approves *expenditure*. Deputy Director approval = irregular expenditure |
| **Payment Authoriser** | Finance Accounting | Authorises actual payment in BAS (transversal system), separate from expenditure approval |

- Director unavailable → Acting Director must be **manually** assigned by admin; NO automatic escalation to Chief Director.
- Internal Control = quality assurance only: applies verification stamp, can refer back with comments, cannot edit or approve payments.
- After Director approval, documents **lock permanently** — no edits by anyone ("moving target" problem).

## Sequential approval workflow

1. Invoice arrives at central email → Supervisor uploads; **AI extracts** Invoice Number, Invoice Date, Received Date, Service Provider, Property/Building, Account Number, Amount, Billing Period, Description; AI suggests score/chart-of-accounts allocation with a **confidence score /10** (below threshold → manual confirmation; anomalies like penalty interest flagged).
2. Admin Clerk verifies AI data, completes system-assisted calculation sheet + digital sundry payment form (standard fields pre-populated and locked; enters Fund Code, Project Code, Asset flag, Score allocation, Provincial/National indicator), applies **digital verification stamp** per document (name, employee number, timestamp, "Verified by Administrator Clerk"), uploads supporting docs → submits back to Supervisor.
3. Supervisor reviews, e-signs → Deputy Director (Checker) e-signs → Director "Approve Expenditure" e-sign → docs lock.
4. Internal Control (2 business days default): authenticated AD link, read-only, applies QC stamp; approve → Finance, or refer back with mandatory comments (to Facilities Management, not the Director).
5. Finance Accounting: authenticated link, loads payment in BAS (outside this system), uploads proof of payment, completes finance section, "Confirm Payment Completed" → completion notifications to all participants.
6. Archival: system compiles complete batch package (zip/PDF, all signatures + stamps + proof) → secure download link to Internal Control → import into FBI archival system. Vault retains ≥**15 years**. Batches bypassing the IC stamp are flagged non-compliant.

## Key features

- **Payment Vault**: centralised, versioned, immutable-after-approval document store; read access for all workflow roles; time-boxed edit access (Admin Clerk only during compilation).
- **E-signatures**: upload image OR draw (stylus/mouse); signatures composited into the sundry form in correct positions replicating the paper layout.
- **Notifications**: in-app + email + **SMS** (SMS minimum for Directors and Internal Control). Configurable per-role deadlines; reminders (e.g. 5 days / 2 days remaining); overdue → auto-escalation. Email links to IC/Finance are authenticated **deep links** straight to the batch.
- **30-day clock**: officially runs to when Finance uploads proof of payment and confirms — not Director approval.
- Reporting: invoices received, processed within 30 days, overdue, avg time per stage, escalations; PDF + Excel export; live status dashboard.

## NFRs / integrations

- Web app (all modern browsers) + mobile app (iOS/Android) per scope; AD SSO for everyone incl. link-based access for IC/Finance without full accounts.
- TLS 1.2+, encryption at rest, least privilege, immutable audit log of every event.
- 99.5% uptime business hours (07:00–18:00 SAST); page load ≤3s; AI extraction ≤30s.
- No direct BAS/PERSAL integration (Finance pays manually in BAS). FBI archival: interim = zip export to network path; future = REST API with OAuth 2.0.
- Retention ≥15 years (financial records). Daily backups, 30-day point-in-time recovery.

## Open items (decisions pending as of the BRS)

Per-role SLA days; final invoice-type list for score validation; final sundry form template; e-signature approach (upload vs drawn); FBI API availability; SMS gateway provider; CFO exemption memorandum status; recurring vs per-invoice supporting docs; AI confidence threshold.

## Glossary

BAS = Basic Accounting System (transversal government financial system). IPMS = current Invoice and Payment Monitoring System (replaced by auto-logging). FBI system = internal document archival system used by Internal Control. Nodal Point = Public Works' centralised invoice receipt point (department has an exemption memorandum). Sundry Payment = government batch form for non-salary payments. Score = chart-of-accounts allocation code.
