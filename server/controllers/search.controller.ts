import { Request, Response } from 'express';
import { query } from '../config/db.js';
import { ResponseView } from '../views/response.view.js';

export const SearchController = {
  async search(req: Request, res: Response) {
    try {
      const q = (req.query.q as string || '').trim();
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
      const incidents = await query<any>(incidentsQuery, [
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
      const btoReports = await query<any>(btoQuery, [
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
      const investigationReports = await query<any>(invQuery, [
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
      const traAudits = await query<any>(traQuery, [
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
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Search failed');
    }
  }
};
