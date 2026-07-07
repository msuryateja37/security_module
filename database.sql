-- SQL DDL Schema for DLRRD Security Module Database

-- 0. System Users Table (BRS 6.1 Stakeholder Register)
-- Profile store for role assignment; authentication itself remains AD SSO (FR-031).
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    displayName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    roleCode VARCHAR(10) NOT NULL, -- EMP, SECCO, CHINV, CHDIR
    roleLabel VARCHAR(100) NOT NULL,
    province VARCHAR(50) NOT NULL,
    office VARCHAR(255),
    clearanceLevel VARCHAR(50),
    isActive INTEGER DEFAULT 1,
    dateCreated VARCHAR(50),
    baseRole VARCHAR(50),        -- set while acting as temporary Security Coordinator (holds permanent role)
    tempAssignedBy VARCHAR(100), -- Chief Director who made the temporary assignment
    persalNumber VARCHAR(20),    -- government HR (PERSAL) identifier — HR/AD-sourced, read-only in portal
    jobTitle VARCHAR(255),       -- designation as used on official forms
    phoneNumber VARCHAR(50),     -- work contact number
    directorate VARCHAR(255),    -- organisational unit (defaults to CD: SFMS)
    preferences TEXT,            -- JSON-serialized UserPreferences (notification settings)
    passwordHash VARCHAR(255),   -- scrypt salt:hash of the portal credential (AD SSO replaces this in production)
    passwordChangedAt VARCHAR(50),
    lastLoginAt VARCHAR(50)
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
