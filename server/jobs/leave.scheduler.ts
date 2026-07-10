import cron from 'node-cron';
import { LeaveService } from '../services/leave.service.js';

// Daily leave sweep: expire undecided requests, remind the Chief Security Director of
// requests starting tomorrow, promote today's acting coordinators (with
// incident handover), and revert covers whose leave window has passed.
//
// Runs at 00:05 South African time every day, plus once on server boot so a
// restart (or a deployment that slept through midnight) catches up — the sweep
// is idempotent, so overlapping runs are harmless.
export const startLeaveScheduler = () => {
  cron.schedule('5 0 * * *', () => void LeaveService.runDailySweep(), {
    timezone: 'Africa/Johannesburg'
  });

  // Boot-time catch-up, slightly delayed so DB initialisation completes first
  setTimeout(() => void LeaveService.runDailySweep(), 5_000);

  console.log('Leave scheduler started (daily at 00:05 Africa/Johannesburg + boot catch-up).');
};
