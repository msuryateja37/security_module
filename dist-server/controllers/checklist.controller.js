import { ChecklistModel } from '../models/checklist.model.js';
import { ResponseView } from '../views/response.view.js';
export const ChecklistController = {
    async getAll(req, res) {
        try {
            const items = await ChecklistModel.getAll();
            ResponseView.sendSuccess(res, items, 'Fetched checklist items successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch checklist items');
        }
    },
    async updateBulk(req, res) {
        try {
            const items = req.body;
            if (!Array.isArray(items)) {
                return ResponseView.sendError(res, 'Expected an array of checklist items', 'Validation failed', 400);
            }
            const success = await ChecklistModel.bulkSave(items);
            if (success) {
                ResponseView.sendSuccess(res, items, 'Updated checklists successfully');
            }
            else {
                ResponseView.sendError(res, 'Failed to save checklist updates', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to update checklists');
        }
    }
};
