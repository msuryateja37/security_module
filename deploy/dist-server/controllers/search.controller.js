import { query } from '../config/db.js';
import { ResponseView } from '../views/response.view.js';
export const SearchController = {
    async search(req, res) {
        try {
            const q = (req.query.q || '').trim();
            if (!q) {
                return ResponseView.sendSuccess(res, {
                    incidents: [],
                    btoReports: [],
                    investigationReports: [],
                    traAudits: []
                }, 'Empty query');
            }
            const searchPattern = `%${q}%`;
            // 1. Search Incidents
            const incidentsQuery = `
        SELECT * FROM incidents 
        WHERE refNo LIKE ? 
           OR place LIKE ? 
           OR province LIKE ? 
           OR natureOfLoss LIKE ? 
           OR whatHappened LIKE ? 
           OR reportedBy LIKE ?
           OR incidentType LIKE ?
        ORDER BY dateTime DESC
      `;
            const incidents = await query(incidentsQuery, [
                searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern
            ]);
            const parsedIncidents = incidents.map(row => ({
                ...row,
                incidentType: JSON.parse(row.incidentType || '[]')
            }));
            // 2. Search BTO Reports
            const btoQuery = `
        SELECT * FROM bto_reports 
        WHERE officialName LIKE ? 
           OR eventName LIKE ? 
           OR venue LIKE ? 
           OR purpose LIKE ?
        ORDER BY dateCreated DESC
      `;
            const btoReports = await query(btoQuery, [
                searchPattern, searchPattern, searchPattern, searchPattern
            ]);
            // 3. Search Investigation Reports
            const invQuery = `
        SELECT * FROM investigation_reports 
        WHERE subject LIKE ? 
           OR findings LIKE ? 
           OR recommendations LIKE ? 
           OR officerName LIKE ?
        ORDER BY dateCreated DESC
      `;
            const investigationReports = await query(invQuery, [
                searchPattern, searchPattern, searchPattern, searchPattern
            ]);
            // 4. Search TRA Audits
            const traQuery = `
        SELECT * FROM tra_audits 
        WHERE officeName LIKE ? 
           OR assessorName LIKE ? 
           OR officeLocation LIKE ?
        ORDER BY dateCreated DESC
      `;
            const traAudits = await query(traQuery, [
                searchPattern, searchPattern, searchPattern
            ]);
            const parsedTraAudits = traAudits.map(row => ({
                ...row,
                checklistValues: JSON.parse(row.checklistValues || '{}')
            }));
            ResponseView.sendSuccess(res, {
                incidents: parsedIncidents,
                btoReports,
                investigationReports,
                traAudits: parsedTraAudits
            }, 'Search completed successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Search failed');
        }
    }
};
