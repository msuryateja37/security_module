import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import mssql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sqliteDb: Database | null = null;
let mssqlPool: mssql.ConnectionPool | null = null;

// Switch based on process.env configuration
const useMssql = !!(process.env.DB_SERVER || process.env.AZURE_SQL_CONNECTIONSTRING);

export async function getDbConnection(): Promise<Database | mssql.ConnectionPool> {
  if (useMssql) {
    if (mssqlPool) return mssqlPool;

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

    mssqlPool = await mssql.connect(config);
    console.log('Connected to Azure SQL Database successfully.');

    // Initialize Schema and Seed if needed
    await initializeMssql(mssqlPool);

    return mssqlPool;
  } else {
    if (sqliteDb) return sqliteDb;

    const dbPath = path.join(process.cwd(), 'security.db');
    const schemaPath = path.join(process.cwd(), 'database.sql');
    const isNew = !fs.existsSync(dbPath);

    sqliteDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    if (isNew) {
      console.log('SQLite database file not found. Creating a new database and initializing tables...');
      if (fs.existsSync(schemaPath)) {
        const ddl = fs.readFileSync(schemaPath, 'utf8');
        await sqliteDb.exec(ddl);
        console.log('Database tables created successfully.');
        await seedDatabaseSqlite(sqliteDb);
      }
    }

    return sqliteDb;
  }
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
  if (useMssql) {
    const { mssqlSql, boundParams } = translateQuery(sql, params);
    const request = (connection as mssql.ConnectionPool).request();
    boundParams.forEach(p => {
      request.input(p.name, p.value);
    });
    const result = await request.query(mssqlSql);
    return result.recordset as T[];
  } else {
    const db = connection as Database;
    return db.all<T[]>(sql, params);
  }
}

// Unified query runner (for single record SELECT)
export async function queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Unified execute runner (returns changes count for INSERT/UPDATE/DELETE)
export async function execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
  const connection = await getDbConnection();
  if (useMssql) {
    const { mssqlSql, boundParams } = translateQuery(sql, params);
    const request = (connection as mssql.ConnectionPool).request();
    boundParams.forEach(p => {
      request.input(p.name, p.value);
    });
    const result = await request.query(mssqlSql);
    return { changes: result.rowsAffected[0] || 0 };
  } else {
    const db = connection as Database;
    const result = await db.run(sql, params);
    return { changes: result.changes || 0 };
  }
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

// SQLite Seeder Helper
async function seedDatabaseSqlite(connection: Database) {
  console.log('Seeding SQLite mock records...');
  const checklists = getChecklistSeed();
  for (const item of checklists) {
    await connection.run(
      `INSERT INTO checklist_items (id, category, task, completed, notes) VALUES (?, ?, ?, ?, ?)`,
      [item.id, item.category, item.task, item.completed, item.notes]
    );
  }

  const incidents = getIncidentSeed();
  for (const incident of incidents) {
    await connection.run(
      `INSERT INTO incidents (
        id, refNo, incidentType, otherIncidentTypeDetails, department, contactDetails,
        dateTime, place, province, lossValue, natureOfLoss, injuriesFatalities, reportedBy,
        registerNumber, sapsCaseNumber, policeStation, arrests, classification, reportedToSapsSsa,
        outcomeOfInvestigation, responsiblePerson, status, dateCreated, dateReported, whatHappened,
        whereHappened, howHappened, whoResponsible, proceduresUsed, weaponsUsed, damageDone,
        actionTaken, securityMeasuresEffectiveness, securityPersonnelReaction, otherAspects,
        lessonsLearned, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.id, incident.refNo, incident.incidentType, incident.otherIncidentTypeDetails, incident.department, incident.contactDetails,
        incident.dateTime, incident.place, incident.province, incident.lossValue, incident.natureOfLoss, incident.injuriesFatalities, incident.reportedBy,
        incident.registerNumber, incident.sapsCaseNumber, incident.policeStation, incident.arrests, incident.classification, incident.reportedToSapsSsa,
        incident.outcomeOfInvestigation, incident.responsiblePerson, incident.status, incident.dateCreated, incident.dateReported, incident.whatHappened,
        incident.whereHappened, incident.howHappened, incident.whoResponsible, incident.proceduresUsed, incident.weaponsUsed, incident.damageDone,
        incident.actionTaken, incident.securityMeasuresEffectiveness, incident.securityPersonnelReaction, incident.otherAspects,
        incident.lessonsLearned, incident.recommendations
      ]
    );
  }

  const stats = getStatsSeed();
  for (const stat of stats) {
    await connection.run(
      `INSERT INTO performance_stats (province, indicator, monthlyValues) VALUES (?, ?, ?)`,
      [stat.province, stat.indicator, stat.monthlyValues]
    );
  }

  // Seed BTO reports
  const btos = getBtoSeed();
  for (const bto of btos) {
    await connection.run(
      `INSERT INTO bto_reports (
        id, officialName, date, venue, times, staffStakeholders, eventName,
        purpose, expectedOutput, discussionPoints, mattersNoting, designation, signature, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bto.id, bto.officialName, bto.date, bto.venue, bto.times, bto.staffStakeholders, bto.eventName,
        bto.purpose, bto.expectedOutput, bto.discussionPoints, bto.mattersNoting, bto.designation, bto.signature, bto.dateCreated
      ]
    );
  }

  // Seed Investigation reports
  const invs = getInvSeed();
  for (const inv of invs) {
    await connection.run(
      `INSERT INTO investigation_reports (
        id, subject, purpose, scope, background, factualInfo, findings,
        recommendations, officerName, rank, office, date, signature, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id, inv.subject, inv.purpose, inv.scope, inv.background, inv.factualInfo, inv.findings,
        inv.recommendations, inv.officerName, inv.rank, inv.office, inv.date, inv.signature, inv.dateCreated
      ]
    );
  }

  // Seed Quarterly reports
  const qtrs = getQtrSeed();
  for (const qtr of qtrs) {
    await connection.run(
      `INSERT INTO quarterly_reports (
        id, province, quarterNumber, year, program, branch, indicatorValues, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qtr.id, qtr.province, qtr.quarterNumber, qtr.year, qtr.program, qtr.branch, qtr.indicatorValues, qtr.dateCreated
      ]
    );
  }

  // Seed TRA Audits
  const tras = getTraSeed();
  for (const tra of tras) {
    await connection.run(
      `INSERT INTO tra_audits (
        id, officeName, date, assessorName, officeLocation, time, managerName,
        assessorSignature, managerSignature, checklistValues, dateCreated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tra.id, tra.officeName, tra.date, tra.assessorName, tra.officeLocation, tra.time, tra.managerName,
        tra.assessorSignature, tra.managerSignature, tra.checklistValues, tra.dateCreated
      ]
    );
  }

  console.log('SQLite database seeded successfully.');
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
      refNo: 'DLRRD/SEC/2026/001',
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
      refNo: 'DLRRD/SEC/2026/002',
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
      refNo: 'DLRRD/SEC/2026/003',
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
