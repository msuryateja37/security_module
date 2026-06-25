import type { SecurityIncident, PerformanceStats, ChecklistItem, ProvinceType } from '../types/security';

export const PROVINCES: ProvinceType[] = [
  'Gauteng',
  'North West',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'KwaZulu Natal',
  'Western Cape',
  'Eastern Cape',
  'Northern Cape'
];

export const MONTHS = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
];

export const PERFORMANCE_INDICATORS = [
  'Information Security Assessment',
  'Security Screening',
  'Vetting forms issued',
  'Security Breaches reported',
  'Preliminary investigation reports submitted',
  'Office Inspections/after hours',
  'Monthly Contract meeting',
  'Key Audits',
  'Maintenance/Monitor Security Systems',
  'Threat and Risk Assessment',
  'SAPS Audit',
  'Special Events'
];

export const initialIncidents: SecurityIncident[] = [
  {
    id: 'inc-1',
    refNo: 'SEC/2026/001',
    incidentType: ['Theft', 'Malicious damage to property'],
    department: 'Chief Directorate: Land Reform',
    contactDetails: '012 312 8624 / thabo.m@dlrrd.gov.za',
    dateTime: '2026-05-12T22:15',
    place: 'Pretoria Headquarters, 4th Floor, Block B',
    province: 'Gauteng',
    lossValue: 45000,
    natureOfLoss: 'Three (3) HP Laptops and damage to office doors.',
    injuriesFatalities: 'None reported. Incident occurred after hours.',
    reportedBy: 'Snr Officer S. Sithole',
    registerNumber: 'IR-2026-05-012',
    sapsCaseNumber: 'CAS 422/05/2026',
    policeStation: 'Pretoria Central',
    arrests: 0,
    classification: 'Restricted',
    reportedToSapsSsa: 'Yes',
    outcomeOfInvestigation: 'Investigation in progress. Security camera footage reviewed, showing two suspects in civilian clothes. Passed to SAPS.',
    responsiblePerson: 'Security Manager Mandla Mnguni',
    status: 'Under Investigation',
    dateCreated: '2026-05-13',
    dateReported: '2026-05-13',
    whatHappened: 'Three state-owned laptops were stolen from offices on the 4th floor. Physical signs of forced entry were found on the wooden door frames.',
    whereHappened: 'Pretoria HQ offices 412, 413, and 415.',
    howHappened: 'Suspects gained entry to the building using a cloned access card, then used crowbars to force open the office doors.',
    whoResponsible: 'Unknown external contractors. Investigation is ongoing to determine who authorized card cloning.',
    proceduresUsed: 'Forced entry (door breach) after bypassing the biometric gates using a cloned access credential.',
    weaponsUsed: 'Crowbar and card cloning device.',
    damageDone: 'Damage to three doors (approx R6,000) and loss of three laptops (approx R39,000).',
    actionTaken: 'Access card disabled, locks on the 4th floor replaced, security patrol schedules updated to increase after-hours frequency.',
    securityMeasuresEffectiveness: 'Ineffective. Card cloning was not detected and after-hours patrol did not cover the 4th floor during the breach window.',
    securityPersonnelReaction: 'Slightly delayed. The breach was only noticed during the morning shift handover.',
    otherAspects: 'Potential collusion with internal staff is suspected due to targeted room entry.',
    lessonsLearned: 'Standard access cards are vulnerable to cloning; biometric multi-factor authentication should be strictly enforced for after-hours access.',
    recommendations: 'Upgrade perimeter readers to encrypted smartcards, implement strict tailgating sensors, and increase CCTV coverage in elevators and stairwells.'
  },
  {
    id: 'inc-2',
    refNo: 'SEC/2026/002',
    incidentType: ['Armed Robbery', 'Hostage situation'],
    department: 'Provincial Shared Services Centre (PSSC)',
    contactDetails: '018 388 7000 / lerato.k@dlrrd.gov.za',
    dateTime: '2026-05-20T14:30',
    place: 'Mmabatho PSSC Office, Main Reception',
    province: 'North West',
    lossValue: 125000,
    natureOfLoss: 'Cash from the vault, security firearms, and staff personal cellphones.',
    injuriesFatalities: 'Two security guards sustained minor injuries during the struggle. No fatalities.',
    reportedBy: 'Security Manager A. Ferreira',
    registerNumber: 'IR-2026-05-020',
    sapsCaseNumber: 'CAS 89/05/2026',
    policeStation: 'Mmabatho Police Station',
    arrests: 2,
    classification: 'Confidential',
    reportedToSapsSsa: 'Yes',
    outcomeOfInvestigation: 'Two suspects arrested near the border. R80,000 cash recovered. Weapon forensics linked them to a local syndicate.',
    responsiblePerson: 'Deputy Director FN Aphane',
    status: 'SAPS Case',
    dateCreated: '2026-05-20',
    dateReported: '2026-05-20',
    whatHappened: 'Four armed men entered the reception posing as clients, drew firearms, held receptionist and guard hostage, and forced the cashier to open the safe.',
    whereHappened: 'Mmabatho PSSC Ground Floor Reception & Cashier Office.',
    howHappened: 'Exploited the lack of physical barriers between the general lobby and the cashier section.',
    whoResponsible: 'Soweto-based robbery syndicate. Two members arrested, two remain at large.',
    proceduresUsed: 'Coercion, hostage-holding, and armed threat.',
    weaponsUsed: '9mm pistols (x3) and a pump-action shotgun.',
    damageDone: 'Broken reception glass divider, trauma counseling for 5 staff members, cash and firearm loss.',
    actionTaken: 'Cash handling operations suspended at this office. Bullet-resistant screens installed at reception. SAPS called immediately.',
    securityMeasuresEffectiveness: 'Failed. Panic buttons did work, triggering prompt response, but physical barriers did not delay the entry of armed suspects.',
    securityPersonnelReaction: 'Complied under threat of force, which prevented fatalities. Tactical backup arrived within 7 minutes.',
    otherAspects: 'The office had been holding high cash volumes due to a delay in cash-in-transit (CIT) pickups.',
    lessonsLearned: 'CIT pickup delays present high security risks. Cash holding limits must be strictly governed.',
    recommendations: 'Transition all office payments to electronic transfers. Install double-door security mantrap at cash offices.'
  },
  {
    id: 'inc-3',
    refNo: 'SEC/2026/003',
    incidentType: ['Loss of information'],
    department: 'Directorate: Information Security',
    contactDetails: '012 312 8600 / dumisani.l@dlrrd.gov.za',
    dateTime: '2026-05-25T11:00',
    place: 'Pretoria Headquarters, Server Room B',
    province: 'Gauteng',
    lossValue: 5000,
    natureOfLoss: 'Restricted draft policy documents leaked on social media.',
    injuriesFatalities: 'None.',
    reportedBy: 'Chief Director D. Lupungela',
    registerNumber: 'IR-2026-05-025',
    sapsCaseNumber: 'N/A - Internal disciplinary',
    policeStation: 'N/A',
    arrests: 0,
    classification: 'Secret',
    reportedToSapsSsa: 'Pending',
    outcomeOfInvestigation: 'Internal audit tracked document watermark to a temporary employee. Disciplinary hearing scheduled.',
    responsiblePerson: 'Chief Director Dumisani Lupungela',
    status: 'Open',
    dateCreated: '2026-05-26',
    dateReported: '2026-05-26',
    whatHappened: 'A draft copy of the 2026 Land Distribution Strategy policy was photographed and leaked on WhatsApp and Twitter.',
    whereHappened: 'HQ administrative support office.',
    howHappened: 'Unauthorised photography of computer screens using personal mobile phones.',
    whoResponsible: 'Contract administrative clerk in the Land Reform Unit.',
    proceduresUsed: 'Bypassing network security blocks by physically taking a picture of the screen.',
    weaponsUsed: 'Personal smartphone camera.',
    damageDone: 'Reputational damage and premature exposure of policy plans.',
    actionTaken: 'Employee access suspended, policy drafts watermarked with individual employee identifiers, clean-desk policy re-enforced.',
    securityMeasuresEffectiveness: 'Good watermark tracking enabled quick identification of the leak source, but the physical restriction of phone usage in secure areas was not enforced.',
    securityPersonnelReaction: 'Prompt response from cybersecurity team to track and identify the leak vectors.',
    otherAspects: 'The leaked policy was still in consultation stage.',
    lessonsLearned: 'Digital assets require visual watermark tracking. High-security environments should restrict mobile device camera usage.',
    recommendations: 'Introduce mobile device restrictions in secure document creation zones. Enforce DLP (Data Loss Prevention) software.'
  }
];

export const initialPerformanceStats: PerformanceStats[] = [
  {
    province: 'Gauteng',
    indicator: 'Information Security Assessment',
    monthlyValues: { Apr: 2, May: 3, Jun: 1, Jul: 4, Aug: 2, Sep: 3, Oct: 5, Nov: 1, Dec: 0, Jan: 2, Feb: 3, Mar: 4 }
  },
  {
    province: 'Gauteng',
    indicator: 'Security Screening',
    monthlyValues: { Apr: 45, May: 62, Jun: 30, Jul: 55, Aug: 48, Sep: 70, Oct: 80, Nov: 40, Dec: 15, Jan: 50, Feb: 65, Mar: 72 }
  },
  {
    province: 'Gauteng',
    indicator: 'Vetting forms issued',
    monthlyValues: { Apr: 20, May: 15, Jun: 25, Jul: 30, Aug: 18, Sep: 22, Oct: 35, Nov: 12, Dec: 5, Jan: 15, Feb: 28, Mar: 30 }
  },
  {
    province: 'Gauteng',
    indicator: 'Security Breaches reported',
    monthlyValues: { Apr: 1, May: 2, Jun: 0, Jul: 1, Aug: 3, Sep: 0, Oct: 1, Nov: 2, Dec: 0, Jan: 1, Feb: 0, Mar: 1 }
  },
  {
    province: 'Gauteng',
    indicator: 'Preliminary investigation reports submitted',
    monthlyValues: { Apr: 1, May: 1, Jun: 1, Jul: 0, Aug: 2, Sep: 1, Oct: 1, Nov: 1, Dec: 0, Jan: 1, Feb: 0, Mar: 1 }
  },
  {
    province: 'Gauteng',
    indicator: 'Office Inspections/after hours',
    monthlyValues: { Apr: 12, May: 14, Jun: 10, Jul: 15, Aug: 12, Sep: 16, Oct: 18, Nov: 12, Dec: 6, Jan: 14, Feb: 15, Mar: 16 }
  },
  {
    province: 'Gauteng',
    indicator: 'Monthly Contract meeting',
    monthlyValues: { Apr: 1, May: 1, Jun: 1, Jul: 1, Aug: 1, Sep: 1, Oct: 1, Nov: 1, Dec: 1, Jan: 1, Feb: 1, Mar: 1 }
  },
  {
    province: 'Gauteng',
    indicator: 'Key Audits',
    monthlyValues: { Apr: 2, May: 1, Jun: 0, Jul: 2, Aug: 1, Sep: 0, Oct: 3, Nov: 1, Dec: 0, Jan: 2, Feb: 1, Mar: 2 }
  },
  {
    province: 'Gauteng',
    indicator: 'Maintenance/Monitor Security Systems',
    monthlyValues: { Apr: 4, May: 4, Jun: 4, Jul: 4, Aug: 4, Sep: 4, Oct: 4, Nov: 4, Dec: 2, Jan: 4, Feb: 4, Mar: 4 }
  },
  {
    province: 'Gauteng',
    indicator: 'Threat and Risk Assessment',
    monthlyValues: { Apr: 1, May: 0, Jun: 1, Jul: 0, Aug: 1, Sep: 0, Oct: 1, Nov: 0, Dec: 0, Jan: 1, Feb: 0, Mar: 1 }
  },
  {
    province: 'Gauteng',
    indicator: 'SAPS Audit',
    monthlyValues: { Apr: 0, May: 1, Jun: 0, Jul: 0, Aug: 0, Sep: 1, Oct: 0, Nov: 0, Dec: 0, Jan: 0, Feb: 0, Mar: 1 }
  },
  {
    province: 'Gauteng',
    indicator: 'Special Events',
    monthlyValues: { Apr: 3, May: 5, Jun: 2, Jul: 4, Aug: 1, Sep: 3, Oct: 6, Nov: 2, Dec: 1, Jan: 3, Feb: 4, Mar: 5 }
  },
  // Default values for other provinces can be filled in programmatically or seeded similarly
  ...PROVINCES.filter(p => p !== 'Gauteng').flatMap(province => 
    PERFORMANCE_INDICATORS.map(indicator => ({
      province,
      indicator,
      monthlyValues: {
        Apr: Math.floor(Math.random() * 8),
        May: Math.floor(Math.random() * 10),
        Jun: Math.floor(Math.random() * 5),
        Jul: Math.floor(Math.random() * 8),
        Aug: Math.floor(Math.random() * 7),
        Sep: Math.floor(Math.random() * 9),
        Oct: Math.floor(Math.random() * 11),
        Nov: Math.floor(Math.random() * 6),
        Dec: Math.floor(Math.random() * 3),
        Jan: Math.floor(Math.random() * 8),
        Feb: Math.floor(Math.random() * 9),
        Mar: Math.floor(Math.random() * 10)
      }
    }))
  )
];

export const policySections = [
  {
    id: 'intro',
    title: '1. Introduction & Objectives',
    content: 'In terms of the Minimum Information Security Standards (MISS), 1996, and Minimum Physical Security Standards (MPSS), the Director-General must implement, monitor, and review the DLRRD Security Policy. The purpose is to protect employees, information, assets, and service delivery from threats like espionage, theft, armed robbery, fraud, and cyber-attacks.',
    highlights: ['MISS 1996 compliance', 'MPSS compliance', 'Risk mitigation']
  },
  {
    id: 'scope',
    title: '2. Scope of Application',
    content: 'This policy applies to all persons (applicants, permanent/temporary employees, casual workers, interns), service providers and contractors (including their employees), visitors, and beneficiaries. It governs all fixed property, information assets, and moveable property owned or leased by DLRRD.',
    highlights: ['All staff & contractors', 'Visitors & beneficiaries', 'All DLRRD premises']
  },
  {
    id: 'physical',
    title: '3. Physical Security & Access Control',
    content: 'Access control is governed strictly. All employees must wear identification cards visibly. Visitors must be signed in, escorted at all times, and wear temporary badges. Key control must be strictly managed: keys must be locked in a key-safe, duplicate keys kept by the Security Manager, and key losses reported immediately. Planned patrols and after-hours inspections are carried out regularly.',
    highlights: ['Visible badges', 'Escorted visitors', 'Secure key safes', 'After-hours patrols']
  },
  {
    id: 'incidents',
    title: '4. Security Incidents and Breaches',
    content: 'All security breaches must be reported immediately to the National Operations Centre (NOC) of the CD: Security and Facilities Management Services. Depending on severity, initial reports should be telephonic/WhatsApp, followed by a formal written Incident Notification Form. A preliminary investigation report must be submitted within 14 days. Incidents involving criminal activities must be reported to the South African Police Service (SAPS).',
    highlights: ['NOC reporting', '14-day report deadline', 'SAPS notifications']
  },
  {
    id: 'information',
    title: '5. Information Classification',
    content: 'Information is categorized into four classification levels:\n\n- RESTRICTED: Compromise would cause inconvenience or embarrassment.\n- CONFIDENTIAL: Compromise would prejudice operation or cause financial/administrative loss.\n- SECRET: Compromise would cause serious damage to security or operational capabilities.\n- TOP SECRET: Compromise would cause exceptionally grave damage.',
    highlights: ['Restricted', 'Confidential', 'Secret', 'Top Secret']
  },
  {
    id: 'personnel',
    title: '6. Personnel Suitability Checks (PSC) & Vetting',
    content: 'All applicants, interns, and external contractors must undergo Personnel Suitability Checks (PSC) and security screening before employment. Security clearance forms (vetting) must be completed. Standard declarations of secrecy are required. Polygraph tests may be conducted in high-security roles or during investigations.',
    highlights: ['Vetting clearances', 'Suitability screening', 'Declarations of secrecy']
  },
  {
    id: 'ict',
    title: '7. ICT & Device Security',
    content: 'Laptops and desktops must be protected with strong passwords/biometrics and encrypted. Laptops must not be left unattended in vehicles or offices; they must be locked in drawers or security cabinets after hours. Internet access is monitored. Remote access is strictly controlled. Data Loss Prevention (DLP) protocols are enforced.',
    highlights: ['Encryption', 'Secure after-hours storage', 'Monitored internet usage']
  }
];

export const initialChecklists: ChecklistItem[] = [
  { id: 'chk-1', category: 'Physical', task: 'Verify all reception visitor logs are signed and up-to-date.', completed: true, notes: 'Morning logs checked. All visitors accounted for.' },
  { id: 'chk-2', category: 'Physical', task: 'Audit key-safe log matches and check key presence.', completed: false, notes: 'Scheduled for Friday afternoon.' },
  { id: 'chk-3', category: 'Information', task: 'Distribute Secrecy Declaration forms to newly onboarded staff.', completed: true, notes: 'Signed by all 5 new interns.' },
  { id: 'chk-4', category: 'After-Hours', task: 'Perform physical lock-up check on floors 2 and 3.', completed: false, notes: 'Night patrol checklist.' },
  { id: 'chk-5', category: 'After-Hours', task: 'Check that all computer monitors are shut off and clean desk policy is adhered to.', completed: false },
  { id: 'chk-6', category: 'Vetting', task: 'Collect and verify pending vetting documents for Land Reform Director.', completed: true, notes: 'Submitted to SSA.' },
  { id: 'chk-7', category: 'Vetting', task: 'Conduct quarterly review of security screening register for service contractors.', completed: false }
];
