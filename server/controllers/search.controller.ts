import { Response } from 'express';
import { query } from '../config/db.js';
import { ResponseView } from '../views/response.view.js';
import { AuthenticatedRequest } from '../security/auth.middleware.js';
import { getPermissionsForRole } from '../security/roleAccess.js';

export const SearchController = {
  async search(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const permissions = getPermissionsForRole(user.role);
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
      })).filter(incident => {
        if (user.role === 'employee') {
          return incident.reportedBy === user.displayName || incident.contactDetails === user.email;
        }
        if (user.role === 'security_coordinator') {
          return incident.province === user.province || incident.province === 'National';
        }
        if (user.role === 'chief_security_investigator') {
          return incident.responsiblePerson === user.displayName;
        }
        return true;
      });

      const canViewReportArchives = permissions.includes('reports:view_archive');

      // 2. Search BTO Reports
      const btoQuery = canViewReportArchives ? `
        SELECT * FROM bto_reports 
        WHERE officialName LIKE ? 
           OR eventName LIKE ? 
           OR venue LIKE ? 
           OR purpose LIKE ?
        ORDER BY dateCreated DESC
      ` : '';
      const btoReports = canViewReportArchives ? await query<any>(btoQuery, [
        searchPattern, searchPattern, searchPattern, searchPattern
      ]) : [];

      // 3. Search Investigation Reports
      const invQuery = canViewReportArchives ? `
        SELECT * FROM investigation_reports 
        WHERE subject LIKE ? 
           OR findings LIKE ? 
           OR recommendations LIKE ? 
           OR officerName LIKE ?
        ORDER BY dateCreated DESC
      ` : '';
      const investigationReports = canViewReportArchives ? await query<any>(invQuery, [
        searchPattern, searchPattern, searchPattern, searchPattern
      ]) : [];

      // 4. Search TRA Audits
      const traQuery = canViewReportArchives ? `
        SELECT * FROM tra_audits 
        WHERE officeName LIKE ? 
           OR assessorName LIKE ? 
           OR officeLocation LIKE ?
        ORDER BY dateCreated DESC
      ` : '';
      const traAudits = canViewReportArchives ? await query<any>(traQuery, [
        searchPattern, searchPattern, searchPattern
      ]) : [];

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
