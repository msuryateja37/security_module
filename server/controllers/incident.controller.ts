import { Request, Response } from 'express';
import { IncidentModel } from '../models/incident.model.js';
import { ResponseView } from '../views/response.view.js';

export const IncidentController = {
  async getAll(req: Request, res: Response) {
    try {
      const incidents = await IncidentModel.getAll();
      ResponseView.sendSuccess(res, incidents, 'Fetched incidents successfully');
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to fetch incidents');
    }
  },

  async create(req: Request, res: Response) {
    try {
      const incident = req.body;
      if (!incident.id || !incident.refNo) {
        return ResponseView.sendError(res, 'Missing incident ID or Reference Number', 'Validation failed', 400);
      }
      
      const success = await IncidentModel.create(incident);
      if (success) {
        ResponseView.sendSuccess(res, incident, 'Created incident successfully', 201);
      } else {
        ResponseView.sendError(res, 'Failed to create record', 'Operation failed');
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to create incident');
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      
      const success = await IncidentModel.update(id, updates);
      if (success) {
        ResponseView.sendSuccess(res, updates, 'Updated incident successfully');
      } else {
        ResponseView.sendError(res, 'Incident not found or no changes made', 'Operation failed', 404);
      }
    } catch (error) {
      ResponseView.sendError(res, error as any, 'Failed to update incident');
    }
  }
};
