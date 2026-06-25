import { query, execute } from '../config/db.js';
export const IncidentModel = {
    async getAll() {
        const rows = await query('SELECT * FROM incidents ORDER BY dateTime DESC');
        return rows.map(row => ({
            ...row,
            incidentType: JSON.parse(row.incidentType || '[]')
        }));
    },
    async create(incident) {
        const result = await execute(`INSERT INTO incidents (
        id, refNo, incidentType, otherIncidentTypeDetails, department, contactDetails,
        dateTime, place, province, lossValue, natureOfLoss, injuriesFatalities, reportedBy,
        registerNumber, sapsCaseNumber, policeStation, arrests, classification, reportedToSapsSsa,
        outcomeOfInvestigation, responsiblePerson, status, dateCreated, dateReported, whatHappened,
        whereHappened, howHappened, whoResponsible, proceduresUsed, weaponsUsed, damageDone,
        actionTaken, securityMeasuresEffectiveness, securityPersonnelReaction, otherAspects,
        lessonsLearned, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            incident.id,
            incident.refNo,
            JSON.stringify(incident.incidentType),
            incident.otherIncidentTypeDetails || '',
            incident.department,
            incident.contactDetails,
            incident.dateTime,
            incident.place,
            incident.province,
            incident.lossValue,
            incident.natureOfLoss,
            incident.injuriesFatalities,
            incident.reportedBy,
            incident.registerNumber,
            incident.sapsCaseNumber || '',
            incident.policeStation || '',
            incident.arrests || 0,
            incident.classification,
            incident.reportedToSapsSsa,
            incident.outcomeOfInvestigation,
            incident.responsiblePerson || '',
            incident.status,
            incident.dateCreated,
            incident.dateReported,
            incident.whatHappened || '',
            incident.whereHappened || '',
            incident.howHappened || '',
            incident.whoResponsible || '',
            incident.proceduresUsed || '',
            incident.weaponsUsed || '',
            incident.damageDone || '',
            incident.actionTaken || '',
            incident.securityMeasuresEffectiveness || '',
            incident.securityPersonnelReaction || '',
            incident.otherAspects || '',
            incident.lessonsLearned || '',
            incident.recommendations || ''
        ]);
        return result.changes !== undefined && result.changes > 0;
    },
    async update(id, incident) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(incident)) {
            if (key === 'id')
                continue;
            fields.push(`${key} = ?`);
            if (key === 'incidentType') {
                values.push(JSON.stringify(value));
            }
            else {
                values.push(value);
            }
        }
        if (fields.length === 0)
            return false;
        values.push(id);
        const queryStr = `UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`;
        const result = await execute(queryStr, values);
        return result.changes !== undefined && result.changes > 0;
    }
};
