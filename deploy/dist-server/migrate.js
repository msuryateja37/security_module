import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import mssql from 'mssql';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
// Load environment variables
dotenv.config();
const dbPath = path.join(process.cwd(), 'security.db');
async function runMigration() {
    console.log('Starting migration from SQLite to Azure SQL Database...');
    if (!fs.existsSync(dbPath)) {
        console.error(`SQLite database file not found at: ${dbPath}`);
        process.exit(1);
    }
    // 1. Connect to SQLite
    console.log('Connecting to SQLite...');
    const sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    console.log('Connected to SQLite.');
    // 2. Connect to Azure SQL
    console.log('Connecting to Azure SQL Database...');
    const mssqlConfig = {
        server: process.env.DB_SERVER || '',
        database: process.env.DB_DATABASE || '',
        user: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '1433'),
        options: {
            encrypt: true,
            trustServerCertificate: false
        }
    };
    const pool = await mssql.connect(mssqlConfig);
    console.log('Connected to Azure SQL Database successfully.');
    // Helper to check if a table exists in SQLite
    const checkTableExistsInSqlite = async (tableName) => {
        const res = await sqliteDb.get(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
        return (res?.count || 0) > 0;
    };
    // --- 1. Migrate checklist_items ---
    if (await checkTableExistsInSqlite('checklist_items')) {
        console.log('Migrating checklist_items...');
        const items = await sqliteDb.all('SELECT * FROM checklist_items');
        console.log(`Found ${items.length} items in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM checklist_items WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('category', item.category)
                .input('task', item.task)
                .input('completed', item.completed)
                .input('notes', item.notes);
            if (exists) {
                await request.query(`
          UPDATE checklist_items 
          SET category = @category, task = @task, completed = @completed, notes = @notes 
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
          INSERT INTO checklist_items (id, category, task, completed, notes) 
          VALUES (@id, @category, @task, @completed, @notes)
        `);
            }
            migratedCount++;
        }
        console.log(`checklist_items: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 2. Migrate performance_stats ---
    if (await checkTableExistsInSqlite('performance_stats')) {
        console.log('Migrating performance_stats...');
        const items = await sqliteDb.all('SELECT * FROM performance_stats');
        console.log(`Found ${items.length} performance stats in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('province', item.province)
                .input('indicator', item.indicator)
                .query('SELECT COUNT(*) as count FROM performance_stats WHERE province = @province AND indicator = @indicator');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('province', item.province)
                .input('indicator', item.indicator)
                .input('monthlyValues', item.monthlyValues);
            if (exists) {
                await request.query(`
          UPDATE performance_stats 
          SET monthlyValues = @monthlyValues 
          WHERE province = @province AND indicator = @indicator
        `);
            }
            else {
                await request.query(`
          INSERT INTO performance_stats (province, indicator, monthlyValues) 
          VALUES (@province, @indicator, @monthlyValues)
        `);
            }
            migratedCount++;
        }
        console.log(`performance_stats: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 3. Migrate incidents ---
    if (await checkTableExistsInSqlite('incidents')) {
        console.log('Migrating incidents...');
        const items = await sqliteDb.all('SELECT * FROM incidents');
        console.log(`Found ${items.length} incidents in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM incidents WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('refNo', item.refNo)
                .input('incidentType', item.incidentType)
                .input('otherIncidentTypeDetails', item.otherIncidentTypeDetails)
                .input('department', item.department)
                .input('contactDetails', item.contactDetails)
                .input('dateTime', item.dateTime)
                .input('place', item.place)
                .input('province', item.province)
                .input('lossValue', item.lossValue)
                .input('natureOfLoss', item.natureOfLoss)
                .input('injuriesFatalities', item.injuriesFatalities)
                .input('reportedBy', item.reportedBy)
                .input('registerNumber', item.registerNumber)
                .input('sapsCaseNumber', item.sapsCaseNumber)
                .input('policeStation', item.policeStation)
                .input('arrests', item.arrests)
                .input('classification', item.classification)
                .input('reportedToSapsSsa', item.reportedToSapsSsa)
                .input('outcomeOfInvestigation', item.outcomeOfInvestigation)
                .input('responsiblePerson', item.responsiblePerson)
                .input('status', item.status)
                .input('dateCreated', item.dateCreated)
                .input('dateReported', item.dateReported)
                .input('whatHappened', item.whatHappened)
                .input('whereHappened', item.whereHappened)
                .input('howHappened', item.howHappened)
                .input('whoResponsible', item.whoResponsible)
                .input('proceduresUsed', item.proceduresUsed)
                .input('weaponsUsed', item.weaponsUsed)
                .input('damageDone', item.damageDone)
                .input('actionTaken', item.actionTaken)
                .input('securityMeasuresEffectiveness', item.securityMeasuresEffectiveness)
                .input('securityPersonnelReaction', item.securityPersonnelReaction)
                .input('otherAspects', item.otherAspects)
                .input('lessonsLearned', item.lessonsLearned)
                .input('recommendations', item.recommendations);
            if (exists) {
                await request.query(`
          UPDATE incidents 
          SET refNo = @refNo, incidentType = @incidentType, otherIncidentTypeDetails = @otherIncidentTypeDetails,
              department = @department, contactDetails = @contactDetails, dateTime = @dateTime, place = @place,
              province = @province, lossValue = @lossValue, natureOfLoss = @natureOfLoss, injuriesFatalities = @injuriesFatalities,
              reportedBy = @reportedBy, registerNumber = @registerNumber, sapsCaseNumber = @sapsCaseNumber,
              policeStation = @policeStation, arrests = @arrests, classification = @classification,
              reportedToSapsSsa = @reportedToSapsSsa, outcomeOfInvestigation = @outcomeOfInvestigation,
              responsiblePerson = @responsiblePerson, status = @status, dateCreated = @dateCreated,
              dateReported = @dateReported, whatHappened = @whatHappened, whereHappened = @whereHappened,
              howHappened = @howHappened, whoResponsible = @whoResponsible, proceduresUsed = @proceduresUsed,
              weaponsUsed = @weaponsUsed, damageDone = @damageDone, actionTaken = @actionTaken,
              securityMeasuresEffectiveness = @securityMeasuresEffectiveness, securityPersonnelReaction = @securityPersonnelReaction,
              otherAspects = @otherAspects, lessonsLearned = @lessonsLearned, recommendations = @recommendations
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
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
          )
        `);
            }
            migratedCount++;
        }
        console.log(`incidents: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 4. Migrate bto_reports ---
    if (await checkTableExistsInSqlite('bto_reports')) {
        console.log('Migrating bto_reports...');
        const items = await sqliteDb.all('SELECT * FROM bto_reports');
        console.log(`Found ${items.length} BTO reports in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM bto_reports WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('officialName', item.officialName)
                .input('date', item.date)
                .input('venue', item.venue)
                .input('times', item.times)
                .input('staffStakeholders', item.staffStakeholders)
                .input('eventName', item.eventName)
                .input('purpose', item.purpose)
                .input('expectedOutput', item.expectedOutput)
                .input('discussionPoints', item.discussionPoints)
                .input('mattersNoting', item.mattersNoting)
                .input('designation', item.designation)
                .input('signature', item.signature)
                .input('dateCreated', item.dateCreated);
            if (exists) {
                await request.query(`
          UPDATE bto_reports 
          SET officialName = @officialName, date = @date, venue = @venue, times = @times,
              staffStakeholders = @staffStakeholders, eventName = @eventName, purpose = @purpose,
              expectedOutput = @expectedOutput, discussionPoints = @discussionPoints, mattersNoting = @mattersNoting,
              designation = @designation, signature = @signature, dateCreated = @dateCreated
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
          INSERT INTO bto_reports (
            id, officialName, date, venue, times, staffStakeholders, eventName,
            purpose, expectedOutput, discussionPoints, mattersNoting, designation,
            signature, dateCreated
          ) VALUES (
            @id, @officialName, @date, @venue, @times, @staffStakeholders, @eventName,
            @purpose, @expectedOutput, @discussionPoints, @mattersNoting, @designation,
            @signature, @dateCreated
          )
        `);
            }
            migratedCount++;
        }
        console.log(`bto_reports: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 5. Migrate investigation_reports ---
    if (await checkTableExistsInSqlite('investigation_reports')) {
        console.log('Migrating investigation_reports...');
        const items = await sqliteDb.all('SELECT * FROM investigation_reports');
        console.log(`Found ${items.length} investigation reports in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM investigation_reports WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('subject', item.subject)
                .input('purpose', item.purpose)
                .input('scope', item.scope)
                .input('background', item.background)
                .input('factualInfo', item.factualInfo)
                .input('findings', item.findings)
                .input('recommendations', item.recommendations)
                .input('officerName', item.officerName)
                .input('rank', item.rank)
                .input('office', item.office)
                .input('date', item.date)
                .input('signature', item.signature)
                .input('dateCreated', item.dateCreated);
            if (exists) {
                await request.query(`
          UPDATE investigation_reports 
          SET subject = @subject, purpose = @purpose, scope = @scope, background = @background,
              factualInfo = @factualInfo, findings = @findings, recommendations = @recommendations,
              officerName = @officerName, rank = @rank, office = @office, date = @date,
              signature = @signature, dateCreated = @dateCreated
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
          INSERT INTO investigation_reports (
            id, subject, purpose, scope, background, factualInfo, findings,
            recommendations, officerName, rank, office, date, signature, dateCreated
          ) VALUES (
            @id, @subject, @purpose, @scope, @background, @factualInfo, @findings,
            @recommendations, @officerName, @rank, @office, @date, @signature, @dateCreated
          )
        `);
            }
            migratedCount++;
        }
        console.log(`investigation_reports: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 6. Migrate quarterly_reports ---
    if (await checkTableExistsInSqlite('quarterly_reports')) {
        console.log('Migrating quarterly_reports...');
        const items = await sqliteDb.all('SELECT * FROM quarterly_reports');
        console.log(`Found ${items.length} quarterly reports in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM quarterly_reports WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('province', item.province)
                .input('quarterNumber', item.quarterNumber)
                .input('year', item.year)
                .input('program', item.program)
                .input('branch', item.branch)
                .input('indicatorValues', item.indicatorValues)
                .input('dateCreated', item.dateCreated);
            if (exists) {
                await request.query(`
          UPDATE quarterly_reports 
          SET province = @province, quarterNumber = @quarterNumber, year = @year,
              program = @program, branch = @branch, indicatorValues = @indicatorValues,
              dateCreated = @dateCreated
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
          INSERT INTO quarterly_reports (
            id, province, quarterNumber, year, program, branch, indicatorValues, dateCreated
          ) VALUES (
            @id, @province, @quarterNumber, @year, @program, @branch, @indicatorValues, @dateCreated
          )
        `);
            }
            migratedCount++;
        }
        console.log(`quarterly_reports: Migrated/synced ${migratedCount} rows.`);
    }
    // --- 7. Migrate tra_audits ---
    if (await checkTableExistsInSqlite('tra_audits')) {
        console.log('Migrating tra_audits...');
        const items = await sqliteDb.all('SELECT * FROM tra_audits');
        console.log(`Found ${items.length} TRA audits in SQLite.`);
        let migratedCount = 0;
        for (const item of items) {
            const checkRes = await pool.request()
                .input('id', item.id)
                .query('SELECT COUNT(*) as count FROM tra_audits WHERE id = @id');
            const exists = checkRes.recordset[0].count > 0;
            const request = pool.request()
                .input('id', item.id)
                .input('officeName', item.officeName)
                .input('date', item.date)
                .input('assessorName', item.assessorName)
                .input('officeLocation', item.officeLocation)
                .input('time', item.time)
                .input('managerName', item.managerName)
                .input('assessorSignature', item.assessorSignature)
                .input('managerSignature', item.managerSignature)
                .input('checklistValues', item.checklistValues)
                .input('dateCreated', item.dateCreated);
            if (exists) {
                await request.query(`
          UPDATE tra_audits 
          SET officeName = @officeName, date = @date, assessorName = @assessorName,
              officeLocation = @officeLocation, time = @time, managerName = @managerName,
              assessorSignature = @assessorSignature, managerSignature = @managerSignature,
              checklistValues = @checklistValues, dateCreated = @dateCreated
          WHERE id = @id
        `);
            }
            else {
                await request.query(`
          INSERT INTO tra_audits (
            id, officeName, date, assessorName, officeLocation, time, managerName,
            assessorSignature, managerSignature, checklistValues, dateCreated
          ) VALUES (
            @id, @officeName, @date, @assessorName, @officeLocation, @time, @managerName,
            @assessorSignature, @managerSignature, @checklistValues, @dateCreated
          )
        `);
            }
            migratedCount++;
        }
        console.log(`tra_audits: Migrated/synced ${migratedCount} rows.`);
    }
    // Close connection pools
    await sqliteDb.close();
    await pool.close();
    console.log('Migration finished successfully!');
}
runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
