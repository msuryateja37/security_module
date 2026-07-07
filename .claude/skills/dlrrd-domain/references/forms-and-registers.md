# Official DLRRD Forms, Registers & Screens

The system digitises real departmental paper forms. When building or changing a screen, match the official form's fields and terminology — users know these forms by heart.

## 1. Incident Notification Form (NOC form, June 2025)

Source: `docs/DLRRD INCIDENT NOTIFICATION FORM JUNE 2025.doc`. Marked **"Confidential when completed"**.

Policy rule printed on the form: per the Minimum Physical Security Standards and Risk Management Policy of 2023, ALL security incidents impacting protection of assets, information, staff, visitors or operations **must be reported without delay to the National Operations Centre (NOC), CD: Security and Facilities Management Services. A full report must be submitted within 14 days.**

### Form fields
- NOC Ref Nr. / Captured by (NOC use)
- Department/Institution
- Contact details: Tel & Fax nr
- Date and time of incident
- Place of occurrence
- Loss to Department/Institution (replacement rand value)
- Nature of loss
- Injuries or Fatalities
- Reported by (Security Manager/Officer)
- Incident register number
- SAPS case number (if reported)
- Number of arrests (if any)
- Incident type (select with an X — see list below)
- If other (please elaborate)
- Initial notification report: brief details incl. names, contact details and relevance
- Submitted by / Contact Details / Date / Time

### Official incident types (the canonical list)
Loss of information · Armed Robbery · Violence (workplace) · Conflict of interest · Malicious damage to property · Trespassing · Bomb Threat · Robbery · Fraud · Extortion · Sabotage · Drugs · Harassment · Assault · Theft · Kidnapping · Arson · Poaching ("Pouching" in the form) · Accidental discharge of a firearm · Acts of terrorism/terror · Violation of permit system · Fire · Explosion · Hostage situation · Firearm related · Permit related · Firearm left unattended · Accidental damage to property · Other

These map to `incidentType` in `src/types/security.ts` / the `incidents` table.

## 2. Security Breaches Register (incident register xlsx)

Source: `docs/DLRRD SECURITY BREACHES REGISTER (INCIDENTS) MAY 2026.xlsx`.
Owner: **Chief Directorate: Security and Facilities Management Services**, Private Bag X833, Pretoria. Contact on file: mandla.mnguni@dalrrd.gov.za, 012 312 8623.

Title format: "SECURITY BREACHES (INCIDENTS): <FY> FINANCIAL YEAR FOR <MONTH> <YEAR>" — registers are per financial year (April–March), reported monthly.

### Register columns (national/provincial register export must match)
1. No.
2. Description of the incident
3. Ref. No.
4. Place of occurrence
5. Province
6. Date of incident
7. Date reported
8. Responsible person
9. Value of loss
10. Classification
11. Outcome of the investigation
12. SAPS CAS No.
13. Reported to SAPS or SSA

Empty values are recorded as "Nil" or "N/A" (not blank).

## 3. Monthly Performance Statistics

Source: `docs/SECURITY MONTHLY REPORT PERFORMANCE STATISTICS 2026 to 2027 MAY 2026.xlsx`.
One sheet per province + a national summary ("SUMMARY OF MONTHLY PERFORMANCE STATISTICS"). Columns are months of the SA government financial year: **Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar** + Total.

### The 12 official performance indicators (rows)
1. Information Security Assessment
2. Security Screening
3. Vetting forms issued
4. Security Breaches reported
5. Preliminary investigation reports submitted
6. Office Inspections/after hours
7. Monthly Contract meeting
8. Key Audits
9. Maintenance/Monitor Security Systems
10. SAPS Audit
11. Threat and Risk Assessment
12. Special Events

These are the indicators in `performance_stats` (province, indicator, monthlyValues JSON).

### Provinces (canonical names used in the workbook)
Gauteng · North West · Free State · Limpopo · Mpumalanga · KwaZulu Natal · Western Cape · Eastern Cape · Northern Cape (9 provinces; national office consolidates).

## 4. Screens document

Source: `docs/DLRRD - SECURITY SCREENS.docx` (mostly screenshots). The five official screens/forms of the system:

| Screen | Existing component | DB table |
|---|---|---|
| Back to Office Report | `BackToOfficeView.tsx` | `bto_reports` |
| Investigation Report | `InvestigationReportView.tsx` | `investigation_reports` |
| Monthly Performance Statistics | `MonthlyStatsView.tsx` | `performance_stats` |
| Security Monthly & Quarterly Report | `MonthlyQuarterlyReportView.tsx` | `quarterly_reports` |
| TRA Checklist | `TraChecklistView.tsx` | `tra_audits` |

Plus incident reporting/register screens (`ReportIncidentView.tsx`, `RegisterView.tsx`) built from the notification form + breaches register above.

## 5. Investigation report structure

From the schema (`investigation_reports`) and BRS: subject, purpose, scope, background, factual information, findings, recommendations, officer name, rank, office, date, signature. Investigations answer: **what, when, where, who and how** (per the Security Policy, internal investigation of a breach must be completed within 14 working days of it being reported).
