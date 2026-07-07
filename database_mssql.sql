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
        roleCode VARCHAR(10) NOT NULL, -- EMP, SECCO, CHINV, CHDIR
        roleLabel VARCHAR(100) NOT NULL,
        province VARCHAR(50) NOT NULL,
        office VARCHAR(255),
        clearanceLevel VARCHAR(50),
        isActive BIT DEFAULT 1,
        dateCreated VARCHAR(50),
        baseRole VARCHAR(50),        -- set while acting as temporary Security Coordinator (holds permanent role)
        tempAssignedBy VARCHAR(100), -- Chief Director who made the temporary assignment
        persalNumber VARCHAR(20),    -- government HR (PERSAL) identifier — HR/AD-sourced, read-only in portal
        jobTitle VARCHAR(255),       -- designation as used on official forms
        phoneNumber VARCHAR(50),     -- work contact number
        directorate VARCHAR(255),    -- organisational unit (defaults to CD: SFMS)
        preferences NVARCHAR(MAX),   -- JSON-serialized UserPreferences (notification settings)
        passwordHash VARCHAR(255),   -- scrypt salt:hash of the portal credential (AD SSO replaces this in production)
        passwordChangedAt VARCHAR(50),
        lastLoginAt VARCHAR(50)
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
        registerNumber VARCHAR(50) NOT NULL,
        sapsCaseNumber VARCHAR(100),
        policeStation VARCHAR(255),
        arrests INT DEFAULT 0,
        classification VARCHAR(50) NOT NULL,
        reportedToSapsSsa VARCHAR(50) NOT NULL,
        outcomeOfInvestigation NVARCHAR(MAX),
        responsiblePerson VARCHAR(255),
        status VARCHAR(50) NOT NULL,
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
        ownerId VARCHAR(100) -- users.username of the record creator
    );
END;
