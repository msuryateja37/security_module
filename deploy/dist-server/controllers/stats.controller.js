import { StatsModel } from '../models/stats.model.js';
import { ResponseView } from '../views/response.view.js';
export const StatsController = {
    async getAll(req, res) {
        try {
            const stats = await StatsModel.getAll();
            ResponseView.sendSuccess(res, stats, 'Fetched performance stats successfully');
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to fetch performance stats');
        }
    },
    async updateBulk(req, res) {
        try {
            const statsList = req.body;
            if (!Array.isArray(statsList)) {
                return ResponseView.sendError(res, 'Expected an array of statistics', 'Validation failed', 400);
            }
            const success = await StatsModel.bulkSave(statsList);
            if (success) {
                ResponseView.sendSuccess(res, statsList, 'Updated performance stats successfully');
            }
            else {
                ResponseView.sendError(res, 'Failed to save stats updates', 'Operation failed');
            }
        }
        catch (error) {
            ResponseView.sendError(res, error, 'Failed to update performance stats');
        }
    }
};
