-- DLRRD Security Module Azure SQL DDL Schema

-- 0. System Users Table (BRS 6.1 Stakeholder Register)
-- Profile store for role assignment; authentication itself remains AD SSO (FR-031).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
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
        isActive BIT DEFAULT 1,
        dateCreated VARCHAR(50),
        baseRole VARCHAR(50),        -- set while acting as temporary Security Coordinator (holds permanent role)
        tempAssignedBy VARCHAR(100), -- Chief Security Director who made the temporary assignment
        persalNumber VARCHAR(20),    -- government HR (PERSAL) identifier — HR/AD-sourced, read-only in portal
        jobTitle VARCHAR(255),       -- designation as used on official forms
        phoneNumber VARCHAR(50),     -- work contact number
        directorate VARCHAR(255),    -- organisational unit (defaults to CD: SFMS)
        avatarUrl VARCHAR(500),      -- storage path of the profile photo (served via /api/auth/avatar)
        preferences NVARCHAR(MAX),   -- JSON-serialized UserPreferences (notification settings)
        passwordHash VARCHAR(255),   -- scrypt salt:hash of the portal credential (AD SSO replaces this in production)
        passwordChangedAt VARCHAR(50),
        lastLoginAt VARCHAR(50),
        totalLeaves INT DEFAULT 0    -- running leave allocation, managed by the Chief Security Director
    );
END;

-- 1. Incidents Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'incidents')
BEGIN
    CREATE TABLE incidents (
        id VARCHAR(50) PRIMARY KEY,
        refNo VARCHAR(50) NOT NULL,
        incidentType NVARCHAR(MAX) NOT NULL, -- JSON array
        otherIncidentTypeDetails NVARCHAR(MAX),
        department VARCHAR(255) NOT NULL,
        contactDetails VARCHAR(255) NOT NULL,
        dateTime VARCHAR(50) NOT NULL,
        place VARCHAR(255) NOT NULL,
        province VARCHAR(50) NOT NULL,
        lossValue DECIMAL(18,2) DEFAULT 0,
        natureOfLoss NVARCHAR(MAX) NOT NULL,
        injuriesFatalities NVARCHAR(MAX) NOT NULL,
        reportedBy VARCHAR(255) NOT NULL,
        reportFor VARCHAR(10) DEFAULT 'Self',  -- Self | Others (reporting on behalf of a colleague)
        reportForEmployee VARCHAR(255),        -- displayName of the tagged employee when reportFor = 'Others'
        registerNumber VARCHAR(50) NOT NULL,
        sapsCaseNumber VARCHAR(100),
        policeStation VARCHAR(255),
        arrests INT DEFAULT 0,
        classification VARCHAR(50) NOT NULL,
        reportedToSapsSsa VARCHAR(50) NOT NULL,
        outcomeOfInvestigation NVARCHAR(MAX),
        responsiblePerson VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        -- End-to-end case workflow (see server/config/db.ts CASE_WORKFLOW_COLUMNS)
        natureOfCase VARCHAR(50),
        workflowStage VARCHAR(50) DEFAULT 'Submitted',
        preliminaryFindings NVARCHAR(MAX),
        investigationFindings NVARCHAR(MAX),
        assignedInvestigator VARCHAR(255),
        assignedInvestigatorBy VARCHAR(255),
        assignedInvestigatorAt VARCHAR(50),
        investigationSubmittedAt VARCHAR(50),
        returnReason NVARCHAR(MAX),
        returnCount INT DEFAULT 0,
        approvedBy VARCHAR(255),
        approvedAt VARCHAR(50),
        approvalNotes NVARCHAR(MAX),
        closedBy VARCHAR(255),
        closedAt VARCHAR(50),
        closureOutcome VARCHAR(50),
        closureReport NVARCHAR(MAX),
        -- Deputy Director review layer (v2 user journeys)
        requestedOutcome VARCHAR(20),         -- close | investigate (asked by the submitter)
        submittedToDdBy VARCHAR(255),
        submittedToDdAt VARCHAR(50),
        ddRecommendation NVARCHAR(MAX),       -- DD's formal recommendations
        ddRecommendedAction VARCHAR(20),      -- close | investigate
        ddReviewedBy VARCHAR(255),
        ddReviewedAt VARCHAR(50),
        -- Investigation time-extension request (coordinator 7-day / investigator 14-day window)
        extensionStatus VARCHAR(20),          -- '' | Pending | Approved | Denied
        extensionRequestedBy VARCHAR(255),
        extensionRequestedByRole VARCHAR(50),
        extensionRequestedAt VARCHAR(50),
        extensionRequestReason NVARCHAR(MAX),
        extensionRequestedDays INT DEFAULT 0,
        extensionDecidedBy VARCHAR(255),
        extensionDecidedByRole VARCHAR(50),
        extensionDecidedAt VARCHAR(50),
        extensionDecisionNote NVARCHAR(MAX),
        extensionDaysGranted INT DEFAULT 0,   -- cumulative working days added to the SLA clocks
        isEscalated BIT DEFAULT 0,
        escalationLevel VARCHAR(50),
        escalationReason VARCHAR(255),
        escalationNotes NVARCHAR(MAX),
        escalatedBy VARCHAR(255),
        escalatedTo VARCHAR(255),
        escalatedAt VARCHAR(50),
        dateCreated VARCHAR(50) NOT NULL,
        dateReported VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100), -- users.username of the record creator
        whatHappened NVARCHAR(MAX),
        whereHappened NVARCHAR(MAX),
        howHappened NVARCHAR(MAX),
        whoResponsible NVARCHAR(MAX),
        proceduresUsed NVARCHAR(MAX),
        weaponsUsed NVARCHAR(MAX),
        damageDone NVARCHAR(MAX),
        actionTaken NVARCHAR(MAX),
        securityMeasuresEffectiveness NVARCHAR(MAX),
        securityPersonnelReaction NVARCHAR(MAX),
        otherAspects NVARCHAR(MAX),
        lessonsLearned NVARCHAR(MAX),
        recommendations NVARCHAR(MAX)
    );
END;

-- 2. Performance Stats Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'performance_stats')
BEGIN
    CREATE TABLE performance_stats (
        province VARCHAR(50) NOT NULL,
        indicator VARCHAR(255) NOT NULL,
        monthlyValues NVARCHAR(MAX) NOT NULL, -- JSON object
        CONSTRAINT PK_performance_stats PRIMARY KEY (province, indicator)
    );
END;

-- 3. Checklist Items Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'checklist_items')
BEGIN
    CREATE TABLE checklist_items (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        task NVARCHAR(MAX) NOT NULL,
        completed INT DEFAULT 0, -- 0 for false, 1 for true
        notes NVARCHAR(MAX)
    );
END;

-- 4. BTO Reports Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bto_reports')
BEGIN
    CREATE TABLE bto_reports (
        id VARCHAR(50) PRIMARY KEY,
        officialName VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        venue VARCHAR(255) NOT NULL,
        times VARCHAR(100) NOT NULL,
        staffStakeholders NVARCHAR(MAX) NOT NULL,
        eventName VARCHAR(255) NOT NULL,
        purpose NVARCHAR(MAX) NOT NULL,
        expectedOutput NVARCHAR(MAX) NOT NULL,
        discussionPoints NVARCHAR(MAX) NOT NULL,
        mattersNoting NVARCHAR(MAX) NOT NULL,
        designation VARCHAR(255) NOT NULL,
        signature NVARCHAR(MAX) NOT NULL,
        dateCreated VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100) -- users.username of the record creator
    );
END;

-- 5. Investigation Reports Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'investigation_reports')
BEGIN
    CREATE TABLE investigation_reports (
        id VARCHAR(50) PRIMARY KEY,
        subject VARCHAR(255) NOT NULL,
        purpose NVARCHAR(MAX) NOT NULL,
        scope NVARCHAR(MAX) NOT NULL,
        background NVARCHAR(MAX) NOT NULL,
        factualInfo NVARCHAR(MAX) NOT NULL,
        findings NVARCHAR(MAX) NOT NULL,
        recommendations NVARCHAR(MAX) NOT NULL,
        officerName VARCHAR(255) NOT NULL,
        rank VARCHAR(100) NOT NULL,
        office VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        signature NVARCHAR(MAX) NOT NULL,
        dateCreated VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100) -- users.username of the record creator
    );
END;

-- 6. Quarterly Reports Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'quarterly_reports')
BEGIN
    CREATE TABLE quarterly_reports (
        id VARCHAR(50) PRIMARY KEY,
        province VARCHAR(50) NOT NULL,
        quarterNumber VARCHAR(50) NOT NULL,
        year VARCHAR(10) NOT NULL,
        program VARCHAR(255) NOT NULL,
        branch VARCHAR(255) NOT NULL,
        indicatorValues NVARCHAR(MAX) NOT NULL, -- JSON object
        dateCreated VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100) -- users.username of the record creator
    );
END;

-- 7. TRA Audits Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tra_audits')
BEGIN
    CREATE TABLE tra_audits (
        id VARCHAR(50) PRIMARY KEY,
        officeName VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        assessorName VARCHAR(255) NOT NULL,
        officeLocation VARCHAR(255) NOT NULL,
        time VARCHAR(50) NOT NULL,
        managerName VARCHAR(255) NOT NULL,
        assessorSignature NVARCHAR(MAX) NOT NULL,
        managerSignature NVARCHAR(MAX) NOT NULL,
        checklistValues NVARCHAR(MAX) NOT NULL, -- JSON object
        dateCreated VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100), -- users.username of the record creator
        status VARCHAR(30) DEFAULT 'signed' -- 'pending_manager' until manager counter-signs, then 'signed'
    );
END;

-- 8. Coordinator Leave Days Table
-- One row per requested working day; days submitted together share a batchId so the
-- Chief Security Director can approve/reject individual days within a single request.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'leave_days')
BEGIN
    CREATE TABLE leave_days (
        id VARCHAR(50) PRIMARY KEY,
        batchId VARCHAR(50) NOT NULL,
        ownerId VARCHAR(100) NOT NULL,        -- users.username of the requesting coordinator
        province VARCHAR(50) NOT NULL,
        leaveDate VARCHAR(50) NOT NULL,       -- 'YYYY-MM-DD'
        reason NVARCHAR(MAX),                 -- personal data (POPIA): visible to owner + Chief Security Director only
        status VARCHAR(20) NOT NULL,          -- Pending | Approved | Rejected | Revoked | Cancelled | Expired
        substituteUsername VARCHAR(100),      -- employee nominated as acting coordinator at approval
        decidedBy VARCHAR(100),
        decidedAt VARCHAR(50),
        decisionNote NVARCHAR(MAX),
        dateCreated VARCHAR(50) NOT NULL
    );
END;

-- 9. Leave Incident Transfers Table
-- Records each incident handed to the acting coordinator so it can be handed back.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'leave_transfers')
BEGIN
    CREATE TABLE leave_transfers (
        id VARCHAR(50) PRIMARY KEY,
        batchId VARCHAR(50) NOT NULL,
        incidentId VARCHAR(50) NOT NULL,
        fromUser VARCHAR(100) NOT NULL,       -- original coordinator username
        toUser VARCHAR(100) NOT NULL,         -- acting coordinator username
        transferredAt VARCHAR(50) NOT NULL,
        restoredAt VARCHAR(50)                -- NULL while the substitution is active
    );
END;

-- 10. In-App Notifications Table (FR-008)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE notifications (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,       -- recipient users.username
        title VARCHAR(200) NOT NULL,
        message NVARCHAR(MAX),
        link VARCHAR(100),                    -- app hash to open, e.g. '#/leaves'
        isRead BIT DEFAULT 0,
        dateCreated VARCHAR(50) NOT NULL
    );
END;

-- 11. System Configuration Table (FR-037/FR-038/FR-039)
-- Managed by the System Administrator: SLA rules, escalation matrices,
-- incident categories and notification templates. Values are JSON and
-- overlay the code defaults in server/services/config.service.ts.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'system_config')
BEGIN
    CREATE TABLE system_config (
        configKey VARCHAR(50) PRIMARY KEY,    -- sla_rules | escalation_rules | incident_categories | notification_templates
        configValue NVARCHAR(MAX) NOT NULL,   -- JSON payload
        updatedBy VARCHAR(100),               -- users.username of the last editor
        updatedAt VARCHAR(50)
    );
END;

-- 12. Case Attachments (FR-004 / FR-014)
-- Supporting documents and evidence uploaded against an incident at any
-- workflow stage. Binary content lives on disk under uploads/<incidentId>/.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attachments')
BEGIN
    CREATE TABLE attachments (
        id VARCHAR(50) PRIMARY KEY,
        incidentId VARCHAR(50) NOT NULL,      -- incidents.id
        fileName VARCHAR(255) NOT NULL,       -- original client file name
        mimeType VARCHAR(100),
        fileSize INT DEFAULT 0,               -- bytes
        category VARCHAR(50),                 -- reporter_document | preliminary_evidence | investigation_evidence | closure_report
        stage VARCHAR(50),                    -- workflowStage at upload time
        uploadedBy VARCHAR(100),              -- users.username
        uploadedByName VARCHAR(255),
        uploadedByRole VARCHAR(50),
        storagePath VARCHAR(500) NOT NULL,    -- relative path under uploads/
        dateCreated VARCHAR(50) NOT NULL
    );
END;

-- 13. Case Workflow Events (FR-010)
-- Immutable per-case timeline of every workflow action.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'case_events')
BEGIN
    CREATE TABLE case_events (
        id VARCHAR(50) PRIMARY KEY,
        incidentId VARCHAR(50) NOT NULL,      -- incidents.id
        eventType VARCHAR(50) NOT NULL,       -- SUBMITTED | REVIEW_STARTED | PRELIMINARY_FINDINGS | ESCALATED | INVESTIGATOR_ASSIGNED | FINDINGS_SUBMITTED | RETURNED | APPROVED | CLOSED | ATTACHMENT_ADDED
        stage VARCHAR(50),                    -- workflowStage after the event
        actor VARCHAR(100),                   -- users.username
        actorName VARCHAR(255),
        actorRole VARCHAR(50),
        notes NVARCHAR(MAX),
        dateCreated VARCHAR(50) NOT NULL
    );
END;

-- 14. Case Comments / Chat Thread (v2 user journeys)
-- Free-form discussion between the case parties. Immutable after insert.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'case_comments')
BEGIN
    CREATE TABLE case_comments (
        id VARCHAR(50) PRIMARY KEY,
        incidentId VARCHAR(50) NOT NULL,      -- incidents.id
        parentId VARCHAR(50),                 -- case_comments.id of the top-level comment when this is a reply
        author VARCHAR(100),                  -- users.username
        authorName VARCHAR(255),
        authorRole VARCHAR(50),
        message NVARCHAR(MAX) NOT NULL,
        dateCreated VARCHAR(50) NOT NULL
    );
END;
