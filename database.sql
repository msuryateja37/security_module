-- SQL DDL Schema for DLRRD Security Module Database

-- 0. System Users Table (BRS 6.1 Stakeholder Register)
-- Profile store for role assignment; authentication itself remains AD SSO (FR-031).
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    displayName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    roleCode VARCHAR(10) NOT NULL, -- EMP, SECCO, CHINV, CHDIR, SYSADM
    roleLabel VARCHAR(100) NOT NULL,
    province VARCHAR(50) NOT NULL,
    office VARCHAR(255),
    clearanceLevel VARCHAR(50),
    isActive INTEGER DEFAULT 1,
    dateCreated VARCHAR(50),
    baseRole VARCHAR(50),        -- set while acting as temporary Security Coordinator (holds permanent role)
    tempAssignedBy VARCHAR(100), -- Chief Security Director who made the temporary assignment
    persalNumber VARCHAR(20),    -- government HR (PERSAL) identifier — HR/AD-sourced, read-only in portal
    jobTitle VARCHAR(255),       -- designation as used on official forms
    phoneNumber VARCHAR(50),     -- work contact number
    directorate VARCHAR(255),    -- organisational unit (defaults to CD: SFMS)
    preferences TEXT,            -- JSON-serialized UserPreferences (notification settings)
    passwordHash VARCHAR(255),   -- scrypt salt:hash of the portal credential (AD SSO replaces this in production)
    passwordChangedAt VARCHAR(50),
    lastLoginAt VARCHAR(50),
    totalLeaves INTEGER DEFAULT 0 -- running leave allocation, managed by the Chief Security Director
);

-- 1. Security Incident Reports Table
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(50) PRIMARY KEY,
    refNo VARCHAR(50) NOT NULL,
    incidentType TEXT NOT NULL, -- JSON-serialized array of strings
    otherIncidentTypeDetails TEXT,
    department VARCHAR(255) NOT NULL,
    contactDetails VARCHAR(255) NOT NULL,
    dateTime VARCHAR(50) NOT NULL,
    place VARCHAR(255) NOT NULL,
    province VARCHAR(50) NOT NULL,
    lossValue REAL DEFAULT 0,
    natureOfLoss TEXT NOT NULL,
    injuriesFatalities TEXT NOT NULL,
    reportedBy VARCHAR(255) NOT NULL,
    registerNumber VARCHAR(50) NOT NULL,
    sapsCaseNumber VARCHAR(100),
    policeStation VARCHAR(255),
    arrests INTEGER DEFAULT 0,
    classification VARCHAR(50) NOT NULL,
    reportedToSapsSsa VARCHAR(50) NOT NULL,
    outcomeOfInvestigation TEXT,
    responsiblePerson VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    -- End-to-end case workflow (see server/config/db.ts CASE_WORKFLOW_COLUMNS)
    natureOfCase VARCHAR(50),             -- expected resolution window chosen by the reporter
    workflowStage VARCHAR(50) DEFAULT 'Submitted', -- Submitted | Under Review | Escalated | Investigation | Pending Approval | Approved | Closed
    preliminaryFindings TEXT,             -- Security Coordinator preliminary investigation capture
    investigationFindings TEXT,           -- Chief Investigator field findings
    assignedInvestigator VARCHAR(255),    -- displayName of the assigned Chief Investigator
    assignedInvestigatorBy VARCHAR(255),
    assignedInvestigatorAt VARCHAR(50),
    investigationSubmittedAt VARCHAR(50),
    returnReason TEXT,                    -- director's reason when returning an investigation
    returnCount INTEGER DEFAULT 0,
    approvedBy VARCHAR(255),
    approvedAt VARCHAR(50),
    approvalNotes TEXT,
    closedBy VARCHAR(255),
    closedAt VARCHAR(50),
    closureOutcome VARCHAR(50),           -- Closed | Recovered | Referred | Unfounded
    closureReport TEXT,
    isEscalated INTEGER DEFAULT 0,
    escalationLevel VARCHAR(50),
    escalationReason VARCHAR(255),
    escalationNotes TEXT,
    escalatedBy VARCHAR(255),
    escalatedTo VARCHAR(255),
    escalatedAt VARCHAR(50),
    dateCreated VARCHAR(50) NOT NULL,
    dateReported VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100), -- users.username of the record creator
    whatHappened TEXT,
    whereHappened TEXT,
    howHappened TEXT,
    whoResponsible TEXT,
    proceduresUsed TEXT,
    weaponsUsed TEXT,
    damageDone TEXT,
    actionTaken TEXT,
    securityMeasuresEffectiveness TEXT,
    securityPersonnelReaction TEXT,
    otherAspects TEXT,
    lessonsLearned TEXT,
    recommendations TEXT
);

-- 2. Performance Statistics Table
CREATE TABLE IF NOT EXISTS performance_stats (
    province VARCHAR(50) NOT NULL,
    indicator VARCHAR(255) NOT NULL,
    monthlyValues TEXT NOT NULL, -- JSON string mapping months (e.g. "Apr") to values (number)
    PRIMARY KEY (province, indicator)
);

-- 3. Operational Checklist Items Table
CREATE TABLE IF NOT EXISTS checklist_items (
    id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    task TEXT NOT NULL,
    completed INTEGER DEFAULT 0, -- 0 for false, 1 for true
    notes TEXT
);

-- 4. Back To Office Reports Table
CREATE TABLE IF NOT EXISTS bto_reports (
    id VARCHAR(50) PRIMARY KEY,
    officialName VARCHAR(255) NOT NULL,
    date VARCHAR(50) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    times VARCHAR(100) NOT NULL,
    staffStakeholders TEXT NOT NULL,
    eventName VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    expectedOutput TEXT NOT NULL,
    discussionPoints TEXT NOT NULL,
    mattersNoting TEXT NOT NULL,
    designation VARCHAR(255) NOT NULL,
    signature TEXT NOT NULL,
    dateCreated VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100) -- users.username of the record creator
);

-- 5. Investigation Reports Table
CREATE TABLE IF NOT EXISTS investigation_reports (
    id VARCHAR(50) PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    scope TEXT NOT NULL,
    background TEXT NOT NULL,
    factualInfo TEXT NOT NULL,
    findings TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    officerName VARCHAR(255) NOT NULL,
    rank VARCHAR(100) NOT NULL,
    office VARCHAR(255) NOT NULL,
    date VARCHAR(50) NOT NULL,
    signature TEXT NOT NULL,
    dateCreated VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100) -- users.username of the record creator
);

-- 6. Monthly & Quarterly Investigation Reports Table
CREATE TABLE IF NOT EXISTS quarterly_reports (
    id VARCHAR(50) PRIMARY KEY,
    province VARCHAR(50) NOT NULL,
    quarterNumber VARCHAR(50) NOT NULL,
    year VARCHAR(10) NOT NULL,
    program VARCHAR(255) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    indicatorValues TEXT NOT NULL, -- JSON-serialized map of IndicatorValues
    dateCreated VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100) -- users.username of the record creator
);

-- 7. Threat and Risk Assessment (TRA) Audits Table
CREATE TABLE IF NOT EXISTS tra_audits (
    id VARCHAR(50) PRIMARY KEY,
    officeName VARCHAR(255) NOT NULL,
    date VARCHAR(50) NOT NULL,
    assessorName VARCHAR(255) NOT NULL,
    officeLocation VARCHAR(255) NOT NULL,
    time VARCHAR(50) NOT NULL,
    managerName VARCHAR(255) NOT NULL,
    assessorSignature TEXT NOT NULL,
    managerSignature TEXT NOT NULL,
    checklistValues TEXT NOT NULL, -- JSON-serialized map of ChecklistValues
    dateCreated VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100) -- users.username of the record creator
);

-- 8. Coordinator Leave Days Table
-- One row per requested working day; days submitted together share a batchId so the
-- Chief Security Director can approve/reject individual days within a single request.
CREATE TABLE IF NOT EXISTS leave_days (
    id VARCHAR(50) PRIMARY KEY,
    batchId VARCHAR(50) NOT NULL,
    ownerId VARCHAR(100) NOT NULL,        -- users.username of the requesting coordinator
    province VARCHAR(50) NOT NULL,
    leaveDate VARCHAR(50) NOT NULL,       -- 'YYYY-MM-DD'
    reason TEXT,                          -- personal data (POPIA): visible to owner + Chief Security Director only
    status VARCHAR(20) NOT NULL,          -- Pending | Approved | Rejected | Revoked | Cancelled | Expired
    substituteUsername VARCHAR(100),      -- employee nominated as acting coordinator at approval
    decidedBy VARCHAR(100),
    decidedAt VARCHAR(50),
    decisionNote TEXT,
    dateCreated VARCHAR(50) NOT NULL
);

-- 9. Leave Incident Transfers Table
-- Records each incident handed to the acting coordinator so it can be handed back.
CREATE TABLE IF NOT EXISTS leave_transfers (
    id VARCHAR(50) PRIMARY KEY,
    batchId VARCHAR(50) NOT NULL,
    incidentId VARCHAR(50) NOT NULL,
    fromUser VARCHAR(100) NOT NULL,       -- original coordinator username
    toUser VARCHAR(100) NOT NULL,         -- acting coordinator username
    transferredAt VARCHAR(50) NOT NULL,
    restoredAt VARCHAR(50)                -- NULL while the substitution is active
);

-- 10. In-App Notifications Table (FR-008)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,       -- recipient users.username
    title VARCHAR(200) NOT NULL,
    message TEXT,
    link VARCHAR(100),                    -- app hash to open, e.g. '#/leaves'
    isRead INTEGER DEFAULT 0,
    dateCreated VARCHAR(50) NOT NULL
);

-- 11. System Configuration Table (FR-037/FR-038/FR-039)
-- Managed by the System Administrator: SLA rules, escalation matrices,
-- incident categories and notification templates. Values are JSON and
-- overlay the code defaults in server/services/config.service.ts.
CREATE TABLE IF NOT EXISTS system_config (
    configKey VARCHAR(50) PRIMARY KEY,    -- sla_rules | escalation_rules | incident_categories | notification_templates
    configValue TEXT NOT NULL,            -- JSON payload
    updatedBy VARCHAR(100),               -- users.username of the last editor
    updatedAt VARCHAR(50)
);

-- 12. Case Attachments (FR-004 / FR-014)
-- Supporting documents and evidence uploaded against an incident at any
-- workflow stage. Binary content lives on disk under uploads/<incidentId>/;
-- this table holds the metadata and access-controlled download path.
CREATE TABLE IF NOT EXISTS attachments (
    id VARCHAR(50) PRIMARY KEY,
    incidentId VARCHAR(50) NOT NULL,      -- incidents.id
    fileName VARCHAR(255) NOT NULL,       -- original client file name
    mimeType VARCHAR(100),
    fileSize INTEGER DEFAULT 0,           -- bytes
    category VARCHAR(50),                 -- reporter_document | preliminary_evidence | investigation_evidence | closure_report
    stage VARCHAR(50),                    -- workflowStage at upload time
    uploadedBy VARCHAR(100),              -- users.username
    uploadedByName VARCHAR(255),
    uploadedByRole VARCHAR(50),
    storagePath VARCHAR(500) NOT NULL,    -- relative path under uploads/
    dateCreated VARCHAR(50) NOT NULL
);

-- 13. Case Workflow Events (FR-010)
-- Immutable per-case timeline of every workflow action, rendered on the
-- case file page and preserved for audit (POPIA / PAJA).
CREATE TABLE IF NOT EXISTS case_events (
    id VARCHAR(50) PRIMARY KEY,
    incidentId VARCHAR(50) NOT NULL,      -- incidents.id
    eventType VARCHAR(50) NOT NULL,       -- SUBMITTED | REVIEW_STARTED | PRELIMINARY_FINDINGS | ESCALATED | INVESTIGATOR_ASSIGNED | FINDINGS_SUBMITTED | RETURNED | APPROVED | CLOSED | ATTACHMENT_ADDED
    stage VARCHAR(50),                    -- workflowStage after the event
    actor VARCHAR(100),                   -- users.username
    actorName VARCHAR(255),
    actorRole VARCHAR(50),
    notes TEXT,
    dateCreated VARCHAR(50) NOT NULL
);
