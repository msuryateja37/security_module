import mssql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROLE_USERS } from '../security/roleAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mssqlPoolPromise: Promise<mssql.ConnectionPool> | null = null;

// Always use Azure SQL (MS SQL) Database
export const isMssql = true;

export async function getDbConnection(): Promise<mssql.ConnectionPool> {
  if (!mssqlPoolPromise) {
    mssqlPoolPromise = connectMssql().catch(err => {
      mssqlPoolPromise = null;
      throw err;
    });
  }
  return mssqlPoolPromise;
}

async function connectMssql(): Promise<mssql.ConnectionPool> {
  console.log('Connecting to Azure SQL Database...');
    const config: mssql.config | string = process.env.AZURE_SQL_CONNECTIONSTRING
      ? process.env.AZURE_SQL_CONNECTIONSTRING
      : {
          server: process.env.DB_SERVER || '',
          database: process.env.DB_DATABASE || '',
          user: process.env.DB_USER || '',
          password: process.env.DB_PASSWORD || '',
          port: parseInt(process.env.DB_PORT || '1433'),
          options: {
            encrypt: true, // required for Azure SQL
            trustServerCertificate: false
          }
        };

    const pool = await mssql.connect(config);
    console.log('Connected to Azure SQL Database successfully.');

    // Azure SQL drops idle connections; without a listener the pool's 'error'
    // event crashes the process (killing any in-flight request). Log it and
    // discard the pool so the next call reconnects.
    pool.on('error', (err) => {
      console.error('Azure SQL connection pool error (will reconnect on next query):', err);
      mssqlPoolPromise = null;
    });

    // Initialize Schema and Seed if needed
    await initializeMssql(pool);

    // Clean up DLRRD prefix from any existing incidents
    try {
      await ensureIncidentEscalationColumnsMssql(pool);
      await pool.request().query("UPDATE incidents SET refNo = REPLACE(refNo, 'DLRRD/', '') WHERE refNo LIKE 'DLRRD/%'");
      console.log('Successfully cleaned up old DLRRD prefixes from Azure SQL incidents.');
    } catch (e) {
      console.error('Failed to run Azure SQL refNo cleanup:', e);
    }

    try {
      await ensureUsersAndOwnershipMssql(pool);
    } catch (e) {
      console.error('Failed to ensure users table / ownerId columns (Azure SQL):', e);
    }

    try {
      await ensureCaseWorkflowMssql(pool);
    } catch (e) {
      console.error('Failed to ensure case workflow columns/tables (Azure SQL):', e);
    }

    try {
      await ensureAuditLogsMssql(pool);
    } catch (e) {
      console.error('Failed to ensure audit_logs table (Azure SQL):', e);
    }

    try {
      await ensureEmployeeIncidentsMssql(pool);
    } catch (e) {
      console.error('Failed to seed employee incidents (Azure SQL):', e);
    }

    return pool;
}

const OWNED_TABLES = ['incidents', 'bto_reports', 'investigation_reports', 'quarterly_reports', 'tra_audits'];

async function ensureUsersAndOwnershipMssql(pool: mssql.ConnectionPool) {
  // Users table exists via database_mssql.sql DDL; ensure it for older deployments
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    CREATE TABLE users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      roleCode VARCHAR(10) NOT NULL,
      roleLabel VARCHAR(100) NOT NULL,
      province VARCHAR(50) NOT NULL,
      office VARCHAR(255),
      clearanceLevel VARCHAR(50),
      isActive BIT DEFAULT 1,
      dateCreated VARCHAR(50)
    );
  `);

  // Temporary Security Coordinator support (Chief Security Director leave-cover assignments)
  // + user profile fields (personal details, notification preferences, portal credential)
  const mssqlUserColumns: [string, string][] = [
    ['baseRole', 'VARCHAR(50)'],
    ['tempAssignedBy', 'VARCHAR(100)'],
    ['persalNumber', 'VARCHAR(20)'],
    ['jobTitle', 'VARCHAR(255)'],
    ['phoneNumber', 'VARCHAR(50)'],
    ['directorate', 'VARCHAR(255)'],
    ['avatarUrl', 'VARCHAR(500)'],
    ['preferences', 'NVARCHAR(MAX)'],
    ['passwordHash', 'VARCHAR(255)'],
    ['passwordChangedAt', 'VARCHAR(50)'],
    ['lastLoginAt', 'VARCHAR(50)'],
    ['totalLeaves', 'INT DEFAULT 0']
  ];
  for (const [name, type] of mssqlUserColumns) {
    await pool.request().query(`IF COL_LENGTH('users', '${name}') IS NULL ALTER TABLE users ADD ${name} ${type};`);
  }

  await migrateRetiredRoles(sql => pool.request().query(sql).then(() => undefined));

  for (const user of ROLE_USERS) {
    // Never overwrite the role of a user currently acting as temporary coordinator (baseRole set)
    await pool.request()
      .input('id', user.id)
      .input('username', user.username)
      .input('displayName', user.displayName)
      .input('email', user.email)
      .input('role', user.role)
      .input('roleCode', user.roleCode)
      .input('roleLabel', user.roleLabel)
      .input('province', user.province)
      .input('office', user.office)
      .input('clearanceLevel', user.clearanceLevel)
      .input('dateCreated', new Date().toISOString())
      .input('persalNumber', user.persalNumber)
      .input('jobTitle', user.jobTitle)
      .input('phoneNumber', user.phoneNumber)
      .input('directorate', user.directorate)
      .query(`
        IF EXISTS (SELECT 1 FROM users WHERE username = @username)
          UPDATE users SET role = @role, roleCode = @roleCode, roleLabel = @roleLabel,
            persalNumber = COALESCE(persalNumber, @persalNumber),
            jobTitle = COALESCE(jobTitle, @jobTitle),
            phoneNumber = COALESCE(phoneNumber, @phoneNumber),
            directorate = COALESCE(directorate, @directorate)
          WHERE username = @username AND baseRole IS NULL
        ELSE
          INSERT INTO users (id, username, displayName, email, role, roleCode, roleLabel, province, office, clearanceLevel, isActive, dateCreated, persalNumber, jobTitle, phoneNumber, directorate)
          VALUES (@id, @username, @displayName, @email, @role, @roleCode, @roleLabel, @province, @office, @clearanceLevel, 1, @dateCreated, @persalNumber, @jobTitle, @phoneNumber, @directorate)
      `);
  }

  for (const table of OWNED_TABLES) {
    await pool.request().query(`IF COL_LENGTH('${table}', 'ownerId') IS NULL ALTER TABLE ${table} ADD ownerId VARCHAR(100);`);
  }

  // TRA two-step sign-off: coordinator/assessor submits ('pending_manager'),
  // a manager counter-signs to finalise ('signed'). Legacy rows predate the
  // workflow, so treat any NULL status as already 'signed'.
  await pool.request().query(`IF COL_LENGTH('tra_audits', 'status') IS NULL ALTER TABLE tra_audits ADD status VARCHAR(30) DEFAULT 'signed';`);
  await pool.request().query(`UPDATE tra_audits SET status = 'signed' WHERE status IS NULL;`);

  await backfillOwnership(sql => pool.request().query(sql).then(() => undefined));
}

// End-to-end case workflow (July 2026): expected resolution window on the report
// form (natureOfCase), fine-grained workflow stage, investigation assignment and
// approval cycle fields, plus supporting-document attachments and the per-case
// event timeline (FR-004 uploads, FR-010 workflow history).
// Stage flow: Submitted -> Under Review -> Closed (small case)
//                                       -> Escalated -> Investigation -> Pending Approval
//                                          -> (Returned => Investigation) | Approved -> Closed
const CASE_WORKFLOW_COLUMNS: [name: string, sqliteType: string, mssqlType: string][] = [
  ['natureOfCase', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['workflowStage', "VARCHAR(50) DEFAULT 'Submitted'", "VARCHAR(50) DEFAULT 'Submitted'"],
  ['preliminaryFindings', 'TEXT', 'NVARCHAR(MAX)'],
  ['investigationFindings', 'TEXT', 'NVARCHAR(MAX)'],
  ['assignedInvestigator', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['assignedInvestigatorBy', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['assignedInvestigatorAt', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['investigationSubmittedAt', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['returnReason', 'TEXT', 'NVARCHAR(MAX)'],
  ['returnCount', 'INTEGER DEFAULT 0', 'INT DEFAULT 0'],
  ['approvedBy', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['approvedAt', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['approvalNotes', 'TEXT', 'NVARCHAR(MAX)'],
  ['closedBy', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['closedAt', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['closureOutcome', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['closureReport', 'TEXT', 'NVARCHAR(MAX)'],
  // "Report For" (July 2026): reporting an incident on behalf of another employee.
  // reportForEmployee holds the tagged employee's display name; richer linking
  // (username/notifications) is a later phase.
  ['reportFor', "VARCHAR(10) DEFAULT 'Self'", "VARCHAR(10) DEFAULT 'Self'"],
  ['reportForEmployee', 'VARCHAR(255)', 'VARCHAR(255)'],
  // Deputy Director review layer (v2 user journeys): coordinator/investigator
  // submissions pass through the DD, who records formal recommendations before
  // the case reaches the Chief Security Director for the final decision.
  ['requestedOutcome', 'VARCHAR(20)', 'VARCHAR(20)'],
  ['submittedToDdBy', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['submittedToDdAt', 'VARCHAR(50)', 'VARCHAR(50)'],
  ['ddRecommendation', 'TEXT', 'NVARCHAR(MAX)'],
  ['ddRecommendedAction', 'VARCHAR(20)', 'VARCHAR(20)'],
  ['ddReviewedBy', 'VARCHAR(255)', 'VARCHAR(255)'],
  ['ddReviewedAt', 'VARCHAR(50)', 'VARCHAR(50)']
];

// Existing rows created before workflowStage existed read back the column default
// ('Submitted'); realign them with their coarse status so old cases keep working.
const CASE_WORKFLOW_BACKFILL = [
  `UPDATE incidents SET workflowStage = 'Closed' WHERE status = 'Closed' AND (workflowStage IS NULL OR workflowStage = 'Submitted')`,
  `UPDATE incidents SET workflowStage = 'Escalated' WHERE isEscalated = 1 AND status <> 'Closed' AND (workflowStage IS NULL OR workflowStage = 'Submitted')`,
  `UPDATE incidents SET workflowStage = 'Under Review' WHERE status IN ('Under Investigation', 'SAPS Case') AND (workflowStage IS NULL OR workflowStage = 'Submitted')`
];

async function ensureCaseWorkflowMssql(pool: mssql.ConnectionPool) {
  for (const [name, , type] of CASE_WORKFLOW_COLUMNS) {
    await pool.request().query(`IF COL_LENGTH('incidents', '${name}') IS NULL ALTER TABLE incidents ADD ${name} ${type};`);
  }

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attachments')
    CREATE TABLE attachments (
      id VARCHAR(50) PRIMARY KEY,
      incidentId VARCHAR(50) NOT NULL,
      fileName VARCHAR(255) NOT NULL,
      mimeType VARCHAR(100),
      fileSize INT DEFAULT 0,
      category VARCHAR(50),
      stage VARCHAR(50),
      uploadedBy VARCHAR(100),
      uploadedByName VARCHAR(255),
      uploadedByRole VARCHAR(50),
      storagePath VARCHAR(500) NOT NULL,
      dateCreated VARCHAR(50) NOT NULL
    );
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'case_events')
    CREATE TABLE case_events (
      id VARCHAR(50) PRIMARY KEY,
      incidentId VARCHAR(50) NOT NULL,
      eventType VARCHAR(50) NOT NULL,
      stage VARCHAR(50),
      actor VARCHAR(100),
      actorName VARCHAR(255),
      actorRole VARCHAR(50),
      notes NVARCHAR(MAX),
      dateCreated VARCHAR(50) NOT NULL
    );
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'case_comments')
    CREATE TABLE case_comments (
      id VARCHAR(50) PRIMARY KEY,
      incidentId VARCHAR(50) NOT NULL,
      parentId VARCHAR(50),
      author VARCHAR(100),
      authorName VARCHAR(255),
      authorRole VARCHAR(50),
      message NVARCHAR(MAX) NOT NULL,
      dateCreated VARCHAR(50) NOT NULL
    );
  `);

  for (const sql of CASE_WORKFLOW_BACKFILL) {
    await pool.request().query(sql);
  }
}

// Role-model migration (July 2026): the 7-role model was reduced to 4 roles, then
// System Administrator was reinstated as the fifth role (client matrix update).
//   assistant_coordinator -> security_coordinator (closest equivalent, keeps provincial scope)
//   executive             -> deactivated (role retired; duties sit with the Chief Security Director).
//                            Rows are kept (isActive = 0) to preserve audit history.
//   system_administrator  -> reactivated with current code/label (ICT/MTS admin role)
async function migrateRetiredRoles(run: (sql: string) => Promise<unknown>) {
  await run(`UPDATE users SET role = 'security_coordinator', roleCode = 'SECCO', roleLabel = 'Security Coordinator' WHERE role = 'assistant_coordinator'`);
  await run(`UPDATE users SET isActive = 0 WHERE role = 'executive'`);
  await run(`UPDATE users SET isActive = 1, roleCode = 'SYSADM', roleLabel = 'System Administrator' WHERE role = 'system_administrator'`);
  // Refresh labels/codes for roles whose terminology changed
  await run(`UPDATE users SET roleCode = 'SECCO', roleLabel = 'Security Coordinator' WHERE role = 'security_coordinator' AND baseRole IS NULL`);
  await run(`UPDATE users SET roleCode = 'CHINV', roleLabel = 'Chief Investigator' WHERE role = 'chief_security_investigator'`);
  await run(`UPDATE users SET roleCode = 'CHDIR', roleLabel = 'Chief Security Director' WHERE role = 'security_director'`);
}

// Link pre-existing seed/demo rows to their creating account where the name
// fields identify them; unmatched legacy rows keep ownerId NULL and remain
// governed by province-level scoping only.
async function backfillOwnership(run: (sql: string) => Promise<unknown>) {
  await run(`UPDATE bto_reports SET ownerId = 'coordinator' WHERE ownerId IS NULL AND officialName = 'Supervisor'`);
  await run(`UPDATE investigation_reports SET ownerId = 'coordinator' WHERE ownerId IS NULL AND officerName = 'Supervisor'`);
  await run(`UPDATE tra_audits SET ownerId = 'coordinator' WHERE ownerId IS NULL AND assessorName = 'Supervisor'`);
  await run(`UPDATE quarterly_reports SET ownerId = 'coordinator' WHERE ownerId IS NULL AND id = 'qtr-seed-1'`);
}

// Immutable audit trail (POPIA/MISS). Created at boot so AuditService never has
// to run DDL on the hot request path; writes are append-only.

async function ensureAuditLogsMssql(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
    CREATE TABLE audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      timestamp VARCHAR(50) NOT NULL,
      userId VARCHAR(100) NOT NULL,
      username VARCHAR(100) NOT NULL,
      userRole VARCHAR(50) NOT NULL,
      province VARCHAR(50),
      action VARCHAR(50) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      resourceId VARCHAR(100),
      details NVARCHAR(MAX),
      ipAddress VARCHAR(50),
      clearanceLevel VARCHAR(50)
    );
  `);
}

async function ensureIncidentEscalationColumnsMssql(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('incidents', 'isEscalated') IS NULL ALTER TABLE incidents ADD isEscalated BIT DEFAULT 0;
    IF COL_LENGTH('incidents', 'escalationLevel') IS NULL ALTER TABLE incidents ADD escalationLevel VARCHAR(50);
    IF COL_LENGTH('incidents', 'escalationReason') IS NULL ALTER TABLE incidents ADD escalationReason VARCHAR(255);
    IF COL_LENGTH('incidents', 'escalationNotes') IS NULL ALTER TABLE incidents ADD escalationNotes NVARCHAR(MAX);
    IF COL_LENGTH('incidents', 'escalatedBy') IS NULL ALTER TABLE incidents ADD escalatedBy VARCHAR(255);
    IF COL_LENGTH('incidents', 'escalatedTo') IS NULL ALTER TABLE incidents ADD escalatedTo VARCHAR(255);
    IF COL_LENGTH('incidents', 'escalatedAt') IS NULL ALTER TABLE incidents ADD escalatedAt VARCHAR(50);
  `);
}

// Positional "?" placeholders in SQL string translated to MS SQL "@p0, @p1..." named inputs
function translateQuery(sql: string, params: any[] = []): { mssqlSql: string; boundParams: { name: string; value: any }[] } {
  let index = 0;
  const mssqlSql = sql.replace(/\?/g, () => `@p${index++}`);
  const boundParams = params.map((val, idx) => ({
    name: `p${idx}`,
    value: val
  }));
  return { mssqlSql, boundParams };
}

// Unified query runner (returns array of records for SELECT)
export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const connection = await getDbConnection();
  const { mssqlSql, boundParams } = translateQuery(sql, params);
  const request = connection.request();
  boundParams.forEach(p => {
    request.input(p.name, p.value);
  });
  const result = await request.query(mssqlSql);
  return result.recordset as T[];
}

// Unified query runner (for single record SELECT)
export async function queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Unified execute runner (returns changes count for INSERT/UPDATE/DELETE)
export async function execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
  const connection = await getDbConnection();
  const { mssqlSql, boundParams } = translateQuery(sql, params);
  const request = connection.request();
  boundParams.forEach(p => {
    request.input(p.name, p.value);
  });
  const result = await request.query(mssqlSql);
  return { changes: result.rowsAffected[0] || 0 };
}

// Initialize MS SQL Database tables
async function initializeMssql(pool: mssql.ConnectionPool) {
  const schemaPath = path.join(process.cwd(), 'database_mssql.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('database_mssql.sql not found.');
    return;
  }

  console.log('Verifying Azure SQL database schemas...');
  const ddl = fs.readFileSync(schemaPath, 'utf8');

  // Execute the entire DDL schema in a single batch
  await pool.request().query(ddl);

  // Check if tables are seeded
  const countResult = await pool.request().query('SELECT COUNT(*) as count FROM checklist_items');
  const count = countResult.recordset[0].count;
  
  const btoCountResult = await pool.request().query('SELECT COUNT(*) as count FROM bto_reports');
  const btoCount = btoCountResult.recordset[0].count;

  if (count === 0 || btoCount === 0) {
    console.log('Azure SQL checklist or report table is empty. Seeding cloud database...');
    await seedDatabaseMssql(pool);
  }
}

// MS SQL Seeder Helper
async function seedDatabaseMssql(pool: mssql.ConnectionPool) {
  console.log('Seeding Azure SQL mock records...');
  
  const checklists = getChecklistSeed();
  for (const item of checklists) {
    await pool.request()
      .input('id', item.id)
      .input('category', item.category)
      .input('task', item.task)
      .input('completed', item.completed)
      .input('notes', item.notes)
      .query(`IF NOT EXISTS (SELECT 1 FROM checklist_items WHERE id = @id)
              INSERT INTO checklist_items (id, category, task, completed, notes) VALUES (@id, @category, @task, @completed, @notes)`);
  }

  const incidents = getIncidentSeed();
  for (const incident of incidents) {
    await pool.request()
      .input('id', incident.id)
      .input('refNo', incident.refNo)
      .input('incidentType', incident.incidentType)
      .input('otherIncidentTypeDetails', incident.otherIncidentTypeDetails)
      .input('department', incident.department)
      .input('contactDetails', incident.contactDetails)
      .input('dateTime', incident.dateTime)
      .input('place', incident.place)
      .input('province', incident.province)
      .input('lossValue', incident.lossValue)
      .input('natureOfLoss', incident.natureOfLoss)
      .input('injuriesFatalities', incident.injuriesFatalities)
      .input('reportedBy', incident.reportedBy)
      .input('registerNumber', incident.registerNumber)
      .input('sapsCaseNumber', incident.sapsCaseNumber)
      .input('policeStation', incident.policeStation)
      .input('arrests', incident.arrests)
      .input('classification', incident.classification)
      .input('reportedToSapsSsa', incident.reportedToSapsSsa)
      .input('outcomeOfInvestigation', incident.outcomeOfInvestigation)
      .input('responsiblePerson', incident.responsiblePerson)
      .input('status', incident.status)
      .input('dateCreated', incident.dateCreated)
      .input('dateReported', incident.dateReported)
      .input('whatHappened', incident.whatHappened)
      .input('whereHappened', incident.whereHappened)
      .input('howHappened', incident.howHappened)
      .input('whoResponsible', incident.whoResponsible)
      .input('proceduresUsed', incident.proceduresUsed)
      .input('weaponsUsed', incident.weaponsUsed)
      .input('damageDone', incident.damageDone)
      .input('actionTaken', incident.actionTaken)
      .input('securityMeasuresEffectiveness', incident.securityMeasuresEffectiveness)
      .input('securityPersonnelReaction', incident.securityPersonnelReaction)
      .input('otherAspects', incident.otherAspects)
      .input('lessonsLearned', incident.lessonsLearned)
      .input('recommendations', incident.recommendations)
      .query(`IF NOT EXISTS (SELECT 1 FROM incidents WHERE id = @id)
              INSERT INTO incidents (
                id, refNo, incidentType, otherIncidentTypeDetails, department, contactDetails,
                dateTime, place, province, lossValue, natureOfLoss, injuriesFatalities, reportedBy,
                registerNumber, sapsCaseNumber, policeStation, arrests, classification, reportedToSapsSsa,
                outcomeOfInvestigation, responsiblePerson, status, dateCreated, dateReported, whatHappened,
                whereHappened, howHappened, whoResponsible, proceduresUsed, weaponsUsed, damageDone,
                actionTaken, securityMeasuresEffectiveness, securityPersonnelReaction, otherAspects,
                lessonsLearned, recommendations
              ) VALUES (
                @id, @refNo, @incidentType, @otherIncidentTypeDetails, @department, @contactDetails,
                @dateTime, @place, @province, @lossValue, @natureOfLoss, @injuriesFatalities, @reportedBy,
                @registerNumber, @sapsCaseNumber, @policeStation, @arrests, @classification, @reportedToSapsSsa,
                @outcomeOfInvestigation, @responsiblePerson, @status, @dateCreated, @dateReported, @whatHappened,
                @whereHappened, @howHappened, @whoResponsible, @proceduresUsed, @weaponsUsed, @damageDone,
                @actionTaken, @securityMeasuresEffectiveness, @securityPersonnelReaction, @otherAspects,
                @lessonsLearned, @recommendations
              )`);
  }

  const stats = getStatsSeed();
  for (const stat of stats) {
    await pool.request()
      .input('province', stat.province)
      .input('indicator', stat.indicator)
      .input('monthlyValues', stat.monthlyValues)
      .query(`IF NOT EXISTS (SELECT 1 FROM performance_stats WHERE province = @province AND indicator = @indicator)
              INSERT INTO performance_stats (province, indicator, monthlyValues) VALUES (@province, @indicator, @monthlyValues)`);
  }

  // Seed BTO reports
  const btos = getBtoSeed();
  for (const bto of btos) {
    await pool.request()
      .input('id', bto.id)
      .input('officialName', bto.officialName)
      .input('date', bto.date)
      .input('venue', bto.venue)
      .input('times', bto.times)
      .input('staffStakeholders', bto.staffStakeholders)
      .input('eventName', bto.eventName)
      .input('purpose', bto.purpose)
      .input('expectedOutput', bto.expectedOutput)
      .input('discussionPoints', bto.discussionPoints)
      .input('mattersNoting', bto.mattersNoting)
      .input('designation', bto.designation)
      .input('signature', bto.signature)
      .input('dateCreated', bto.dateCreated)
      .query(`IF NOT EXISTS (SELECT 1 FROM bto_reports WHERE id = @id)
              INSERT INTO bto_reports (
                id, officialName, date, venue, times, staffStakeholders, eventName,
                purpose, expectedOutput, discussionPoints, mattersNoting, designation, signature, dateCreated
              ) VALUES (
                @id, @officialName, @date, @venue, @times, @staffStakeholders, @eventName,
                @purpose, @expectedOutput, @discussionPoints, @mattersNoting, @designation, @signature, @dateCreated
              )`);
  }

  // Seed Investigation reports
  const invs = getInvSeed();
  for (const inv of invs) {
    await pool.request()
      .input('id', inv.id)
      .input('subject', inv.subject)
      .input('purpose', inv.purpose)
      .input('scope', inv.scope)
      .input('background', inv.background)
      .input('factualInfo', inv.factualInfo)
      .input('findings', inv.findings)
      .input('recommendations', inv.recommendations)
      .input('officerName', inv.officerName)
      .input('rank', inv.rank)
      .input('office', inv.office)
      .input('date', inv.date)
      .input('signature', inv.signature)
      .input('dateCreated', inv.dateCreated)
      .query(`IF NOT EXISTS (SELECT 1 FROM investigation_reports WHERE id = @id)
              INSERT INTO investigation_reports (
                id, subject, purpose, scope, background, factualInfo, findings,
                recommendations, officerName, rank, office, date, signature, dateCreated
              ) VALUES (
                @id, @subject, @purpose, @scope, @background, @factualInfo, @findings,
                @recommendations, @officerName, @rank, @office, @date, @signature, @dateCreated
              )`);
  }

  // Seed Quarterly reports
  const qtrs = getQtrSeed();
  for (const qtr of qtrs) {
    await pool.request()
      .input('id', qtr.id)
      .input('province', qtr.province)
      .input('quarterNumber', qtr.quarterNumber)
      .input('year', qtr.year)
      .input('program', qtr.program)
      .input('branch', qtr.branch)
      .input('indicatorValues', qtr.indicatorValues)
      .input('dateCreated', qtr.dateCreated)
      .query(`IF NOT EXISTS (SELECT 1 FROM quarterly_reports WHERE id = @id)
              INSERT INTO quarterly_reports (
                id, province, quarterNumber, year, program, branch, indicatorValues, dateCreated
              ) VALUES (
                @id, @province, @quarterNumber, @year, @program, @branch, @indicatorValues, @dateCreated
              )`);
  }

  // Seed TRA Audits
  const tras = getTraSeed();
  for (const tra of tras) {
    await pool.request()
      .input('id', tra.id)
      .input('officeName', tra.officeName)
      .input('date', tra.date)
      .input('assessorName', tra.assessorName)
      .input('officeLocation', tra.officeLocation)
      .input('time', tra.time)
      .input('managerName', tra.managerName)
      .input('assessorSignature', tra.assessorSignature)
      .input('managerSignature', tra.managerSignature)
      .input('checklistValues', tra.checklistValues)
      .input('dateCreated', tra.dateCreated)
      .query(`IF NOT EXISTS (SELECT 1 FROM tra_audits WHERE id = @id)
              INSERT INTO tra_audits (
                id, officeName, date, assessorName, officeLocation, time, managerName,
                assessorSignature, managerSignature, checklistValues, dateCreated
              ) VALUES (
                @id, @officeName, @date, @assessorName, @officeLocation, @time, @managerName,
        @assessorSignature, @managerSignature, @checklistValues, @dateCreated
      )`);
  }

  console.log('Azure SQL database seeded successfully.');
}

export async function ensureEmployeeIncidentsMssql(pool: mssql.ConnectionPool) {
  // Clear any previous corrupt employee seed rows to force re-seeding
  await pool.request().query("DELETE FROM incidents WHERE id LIKE 'emp-inc-%'");

  const seedIncidents = [
    {
      id: 'emp-inc-1',
      refNo: 'ECP/07-2026/2001',
      incidentType: '["Theft"]',
      department: 'ICT Services',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-01T10:00',
      place: 'East London Office, Room 204',
      province: 'Eastern Cape',
      lossValue: 15000,
      natureOfLoss: 'HP laptop stolen from desk',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2001',
      classification: 'Restricted',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Pending review',
      responsiblePerson: 'Unassigned',
      status: 'Open',
      workflowStage: 'Submitted',
      dateCreated: '2026-07-01',
      dateReported: '2026-07-01',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-2',
      refNo: 'ECP/07-2026/2002',
      incidentType: '["Trespassing"]',
      department: 'Corporate Services',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-01T11:00',
      place: 'East London Office, Reception lobby',
      province: 'Eastern Cape',
      lossValue: 2000,
      natureOfLoss: 'Unauthorised visitor breached barrier gate',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2002',
      classification: 'Restricted',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Pending review',
      responsiblePerson: 'Unassigned',
      status: 'Open',
      workflowStage: 'Submitted',
      dateCreated: '2026-07-01',
      dateReported: '2026-07-01',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-3',
      refNo: 'ECP/07-2026/2003',
      incidentType: '["Theft"]',
      department: 'Finance Directorate',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-01T12:00',
      place: 'East London Office, 3rd Floor Safe Room',
      province: 'Eastern Cape',
      lossValue: 8000,
      natureOfLoss: 'Finance document box missing',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2003',
      classification: 'Confidential',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Pending review',
      responsiblePerson: 'Unassigned',
      status: 'Open',
      workflowStage: 'Submitted',
      dateCreated: '2026-07-01',
      dateReported: '2026-07-01',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-4',
      refNo: 'ECP/07-2026/2004',
      incidentType: '["Loss of information"]',
      department: 'Information Security',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-01T13:00',
      place: 'East London Office, Registry room',
      province: 'Eastern Cape',
      lossValue: 500,
      natureOfLoss: 'Registry logs document photographed',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2004',
      classification: 'Confidential',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Pending review',
      responsiblePerson: 'Unassigned',
      status: 'Open',
      workflowStage: 'Submitted',
      dateCreated: '2026-07-01',
      dateReported: '2026-07-01',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-5',
      refNo: 'ECP/07-2026/2005',
      incidentType: '["Robbery"]',
      department: 'Supply Chain Management',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-01T14:00',
      place: 'East London Office, SCM loading zone',
      province: 'Eastern Cape',
      lossValue: 40000,
      natureOfLoss: 'Inventory cart hijacked on arrival',
      injuriesFatalities: 'Guards threatened at gunpoint',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2005',
      classification: 'Confidential',
      reportedToSapsSsa: 'Yes',
      outcomeOfInvestigation: 'Under investigation',
      responsiblePerson: 'Chief Investigator',
      status: 'Under Investigation',
      workflowStage: 'Investigation',
      dateCreated: '2026-07-01',
      dateReported: '2026-07-01',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-6',
      refNo: 'ECP/07-2026/2006',
      incidentType: '["Theft"]',
      department: 'General Support',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-02T09:00',
      place: 'East London Office, Parking basement',
      province: 'Eastern Cape',
      lossValue: 12000,
      natureOfLoss: 'State vehicle spare wheel stolen',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2006',
      classification: 'Restricted',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Under investigation',
      responsiblePerson: 'Chief Investigator',
      status: 'Under Investigation',
      workflowStage: 'Investigation',
      dateCreated: '2026-07-02',
      dateReported: '2026-07-02',
      ownerId: 'employee2'
    },
    {
      id: 'emp-inc-7',
      refNo: 'ECP/07-2026/2007',
      incidentType: '["Theft"]',
      department: 'Registry Services',
      contactDetails: 'employee2@dlrrd.gov.za',
      dateTime: '2026-07-03T16:00',
      place: 'East London Office, Room 102',
      province: 'Eastern Cape',
      lossValue: 3000,
      natureOfLoss: 'Lost office access credentials card',
      injuriesFatalities: 'None',
      reportedBy: 'Employee User 2',
      registerNumber: 'ECP/07-2026/2007',
      classification: 'Restricted',
      reportedToSapsSsa: 'No',
      outcomeOfInvestigation: 'Card disabled. Replacement card issued.',
      responsiblePerson: 'System Administrator',
      status: 'Closed',
      workflowStage: 'Closed',
      dateCreated: '2026-07-03',
      dateReported: '2026-07-03',
      ownerId: 'employee2'
    }
  ];

  for (const inc of seedIncidents) {
    await pool.request()
      .input('id', inc.id)
      .input('refNo', inc.refNo)
      .input('incidentType', inc.incidentType)
      .input('department', inc.department)
      .input('contactDetails', inc.contactDetails)
      .input('dateTime', inc.dateTime)
      .input('place', inc.place)
      .input('province', inc.province)
      .input('lossValue', inc.lossValue)
      .input('natureOfLoss', inc.natureOfLoss)
      .input('injuriesFatalities', inc.injuriesFatalities)
      .input('reportedBy', inc.reportedBy)
      .input('registerNumber', inc.registerNumber)
      .input('classification', inc.classification)
      .input('reportedToSapsSsa', inc.reportedToSapsSsa)
      .input('outcomeOfInvestigation', inc.outcomeOfInvestigation)
      .input('responsiblePerson', inc.responsiblePerson)
      .input('status', inc.status)
      .input('workflowStage', inc.workflowStage)
      .input('dateCreated', inc.dateCreated)
      .input('dateReported', inc.dateReported)
      .input('ownerId', inc.ownerId)
      .query(`INSERT INTO incidents (
        id, refNo, incidentType, department, contactDetails, dateTime, place, province, lossValue, 
        natureOfLoss, injuriesFatalities, reportedBy, registerNumber, classification, reportedToSapsSsa, 
        outcomeOfInvestigation, responsiblePerson, status, workflowStage, dateCreated, dateReported, ownerId
      ) VALUES (@id, @refNo, @incidentType, @department, @contactDetails, @dateTime, @place, @province, @lossValue, 
        @natureOfLoss, @injuriesFatalities, @reportedBy, @registerNumber, @classification, @reportedToSapsSsa, 
        @outcomeOfInvestigation, @responsiblePerson, @status, @workflowStage, @dateCreated, @dateReported, @ownerId)`);
  }
}

// Mock checklist data helper
function getChecklistSeed() {
  return [
    { id: 'chk-1', category: 'Physical', task: 'Verify all reception visitor logs are signed and up-to-date.', completed: 1, notes: 'Morning logs checked. All visitors accounted for.' },
    { id: 'chk-2', category: 'Physical', task: 'Audit key-safe log matches and check key presence.', completed: 0, notes: 'Scheduled for Friday afternoon.' },
    { id: 'chk-3', category: 'Information', task: 'Distribute Secrecy Declaration forms to newly onboarded staff.', completed: 1, notes: 'Signed by all 5 new interns.' },
    { id: 'chk-4', category: 'After-Hours', task: 'Perform physical lock-up check on floors 2 and 3.', completed: 0, notes: 'Night patrol checklist.' },
    { id: 'chk-5', category: 'After-Hours', task: 'Check that all computer monitors are shut off and clean desk policy is adhered to.', completed: 0, notes: '' },
    { id: 'chk-6', category: 'Vetting', task: 'Collect and verify pending vetting documents for Land Reform Director.', completed: 1, notes: 'Submitted to SSA.' },
    { id: 'chk-7', category: 'Vetting', task: 'Conduct quarterly review of security screening register for service contractors.', completed: 0, notes: '' }
  ];
}

// Mock incidents data helper
function getIncidentSeed() {
  return [
    {
      id: 'inc-1',
      refNo: 'GAU/05-2026/1001',
      incidentType: JSON.stringify(['Theft', 'Malicious damage to property']),
      otherIncidentTypeDetails: '',
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
      refNo: 'NWP/05-2026/1002',
      incidentType: JSON.stringify(['Armed Robbery', 'Hostage situation']),
      otherIncidentTypeDetails: '',
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
      refNo: 'GAU/05-2026/1003',
      incidentType: JSON.stringify(['Loss of information']),
      otherIncidentTypeDetails: '',
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
}

// Mock performance stats helper
function getStatsSeed() {
  const provinces = [
    'Gauteng', 'North West', 'Free State', 'Limpopo', 'Mpumalanga',
    'KwaZulu Natal', 'Western Cape', 'Eastern Cape', 'Northern Cape'
  ];
  const indicators = [
    'Information Security Assessment', 'Security Screening', 'Vetting forms issued',
    'Security Breaches reported', 'Preliminary investigation reports submitted',
    'Office Inspections/after hours', 'Monthly Contract meeting', 'Key Audits',
    'Maintenance/Monitor Security Systems', 'Threat and Risk Assessment',
    'SAPS Audit', 'Special Events'
  ];

  const list: { province: string; indicator: string; monthlyValues: string }[] = [];

  const gautengStats = [
    { indicator: 'Information Security Assessment', val: { Apr: 2, May: 3, Jun: 1, Jul: 4, Aug: 2, Sep: 3, Oct: 5, Nov: 1, Dec: 0, Jan: 2, Feb: 3, Mar: 4 } },
    { indicator: 'Security Screening', val: { Apr: 45, May: 62, Jun: 30, Jul: 55, Aug: 48, Sep: 70, Oct: 80, Nov: 40, Dec: 15, Jan: 50, Feb: 65, Mar: 72 } },
    { indicator: 'Vetting forms issued', val: { Apr: 20, May: 15, Jun: 25, Jul: 30, Aug: 18, Sep: 22, Oct: 35, Nov: 12, Dec: 5, Jan: 15, Feb: 28, Mar: 30 } },
    { indicator: 'Security Breaches reported', val: { Apr: 1, May: 2, Jun: 0, Jul: 1, Aug: 3, Sep: 0, Oct: 1, Nov: 2, Dec: 0, Jan: 1, Feb: 0, Mar: 1 } },
    { indicator: 'Preliminary investigation reports submitted', val: { Apr: 1, May: 1, Jun: 1, Jul: 0, Aug: 2, Sep: 1, Oct: 1, Nov: 1, Dec: 0, Jan: 1, Feb: 0, Mar: 1 } },
    { indicator: 'Office Inspections/after hours', val: { Apr: 12, May: 14, Jun: 10, Jul: 15, Aug: 12, Sep: 16, Oct: 18, Nov: 12, Dec: 6, Jan: 14, Feb: 15, Mar: 16 } },
    { indicator: 'Monthly Contract meeting', val: { Apr: 1, May: 1, Jun: 1, Jul: 1, Aug: 1, Sep: 1, Oct: 1, Nov: 1, Dec: 1, Jan: 1, Feb: 1, Mar: 1 } },
    { indicator: 'Key Audits', val: { Apr: 2, May: 1, Jun: 0, Jul: 2, Aug: 1, Sep: 0, Oct: 3, Nov: 1, Dec: 0, Jan: 2, Feb: 1, Mar: 2 } },
    { indicator: 'Maintenance/Monitor Security Systems', val: { Apr: 4, May: 4, Jun: 4, Jul: 4, Aug: 4, Sep: 4, Oct: 4, Nov: 4, Dec: 2, Jan: 4, Feb: 4, Mar: 4 } },
    { indicator: 'Threat and Risk Assessment', val: { Apr: 1, May: 0, Jun: 1, Jul: 0, Aug: 1, Sep: 0, Oct: 1, Nov: 0, Dec: 0, Jan: 1, Feb: 0, Mar: 1 } },
    { indicator: 'SAPS Audit', val: { Apr: 0, May: 1, Jun: 0, Jul: 0, Aug: 0, Sep: 1, Oct: 0, Nov: 0, Dec: 0, Jan: 0, Feb: 0, Mar: 1 } },
    { indicator: 'Special Events', val: { Apr: 3, May: 5, Jun: 2, Jul: 4, Aug: 1, Sep: 3, Oct: 6, Nov: 2, Dec: 1, Jan: 3, Feb: 4, Mar: 5 } }
  ];

  for (const stat of gautengStats) {
    list.push({
      province: 'Gauteng',
      indicator: stat.indicator,
      monthlyValues: JSON.stringify(stat.val)
    });
  }

  for (const province of provinces) {
    if (province === 'Gauteng') continue;
    for (const indicator of indicators) {
      const val = {
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
      };
      list.push({
        province,
        indicator,
        monthlyValues: JSON.stringify(val)
      });
    }
  }

  return list;
}

function getBtoSeed() {
  return [
    {
      id: 'bto-seed-1',
      officialName: 'Supervisor',
      date: '2026-05-14',
      venue: 'DLRRD Pretoria HQ Boardroom 4B',
      times: '09:00 - 11:30',
      staffStakeholders: 'Manager Mandla Mnguni, Director Dumisani Lupungela, and 3 SAPS Central Officers.',
      eventName: 'HQ Incident Response Review & Security Strategy Alignment',
      purpose: 'Review response protocols for theft incident inc-1 and align on physical security enhancements.',
      expectedOutput: 'Action plan for lock replacement on 4th floor and security card credential updates.',
      discussionPoints: 'Detailed timeline of card cloning vulnerability analyzed. SAPS Central confirmed case status. Agreed to replace card readers with dual-factor systems.',
      mattersNoting: 'Physical guards will perform floor check sheets every 2 hours after 20:00.',
      designation: 'Senior Security Supervisor',
      signature: 'Supervisor_Sig',
      dateCreated: '2026-05-14'
    }
  ];
}

function getInvSeed() {
  return [
    {
      id: 'inv-seed-1',
      subject: 'Theft of State Property (Laptops) - Pretoria Headquarters',
      purpose: 'Determine root cause of unauthorized access and laptop theft on 2026-05-12.',
      scope: '4th floor office doors, biometric gate log, and security surveillance camera tapes.',
      background: 'On 2026-05-12, three HP laptops were stolen from administrative office rooms on 4th floor block B.',
      factualInfo: 'Access log shows access badge #4982 (cloned clone-card) used at 22:12. Surveillance footage shows two suspects with toolbags entering Block B elevator.',
      findings: 'Entry door frame shows forced leverage damage. Guard patrol skipped the floor due to emergency response elsewhere.',
      recommendations: 'Implement mandatory visual card checks. Replace elevator floor access permissions with smartcard readers.',
      officerName: 'Supervisor',
      rank: 'Senior Security Supervisor',
      office: 'Pretoria Central Office',
      date: '2026-05-15',
      signature: 'Supervisor_Investigation',
      dateCreated: '2026-05-15'
    }
  ];
}

function getQtrSeed() {
  return [
    {
      id: 'qtr-seed-1',
      province: 'Gauteng',
      quarterNumber: '1',
      year: '2026',
      program: 'Security Operations Support',
      branch: 'National Operations Centre',
      indicatorValues: JSON.stringify({
        'Information Security Assessment': { annualTarget: 10, quarterTarget: 3, monthlyTarget: 1, actualQuarterPerformance: 3, month1Val: 1, month2Val: 1, month3Val: 1, varianceReasons: 'None', correctiveAction: 'None' },
        'Security Screening': { annualTarget: 200, quarterTarget: 50, monthlyTarget: 17, actualQuarterPerformance: 65, month1Val: 20, month2Val: 25, month3Val: 20, varianceReasons: 'Additional intakes', correctiveAction: 'N/A' }
      }),
      dateCreated: '2026-06-01'
    }
  ];
}

function getTraSeed() {
  return [
    {
      id: 'tra-seed-1',
      officeName: 'Pretoria Headquarters',
      date: '2026-05-10',
      assessorName: 'Supervisor',
      officeLocation: '184 Jeff Masemola Street, Pretoria',
      time: '10:00',
      managerName: 'Manager Mandla Mnguni',
      assessorSignature: 'Assessor_Supervisor_Sig',
      managerSignature: 'Manager_Mandla_Sig',
      checklistValues: JSON.stringify({
        'a1': { status: 'Compliant', notes: 'Vetting registers updated.' },
        'a2': { status: 'Compliant', notes: 'Documents classification active.' },
        'b1': { status: 'Compliant', notes: 'Control room locked.' },
        'b2': { status: 'Non-Compliant', notes: 'Visitor logs missing some checkout stamps.' },
        'c1': { status: 'Compliant', notes: 'Evacuation maps visible.' }
      }),
      dateCreated: '2026-05-10'
    }
  ];
}
