import cron from 'node-cron';
import { SlaMonitorService } from '../services/slaMonitor.service.js';

// SLA sweeps (hourly + boot catch-up):
//   1. Assignment breach — alert the national roles when a Submitted incident has gone
//      unassigned past its 24h assignment SLA, recording each breach on the timeline.
//   2. Coordinator pre-breach warning — alert the Chief Security Director + Deputy
//      Director when an assigned coordinator has captured no preliminary findings or
//      documents by day 6 of their 7-day preliminary-investigation window.
//
// Hourly (not daily) — an hours/days deadline can't be watched by a once-a-day sweep
// without up to a day of slop. Also runs once on boot so a restart catches up. Both
// sweeps are idempotent (events and alerts are de-duplicated), so overlapping runs are safe.
const runAllSweeps = () => {
  void SlaMonitorService.runAssignmentSweep();
  void SlaMonitorService.runCoordinatorInvestigationSweep();
};

export const startSlaScheduler = () => {
  cron.schedule('0 * * * *', runAllSweeps, {
    timezone: 'Africa/Johannesburg'
  });

  // Boot-time catch-up, slightly delayed so DB initialisation completes first
  setTimeout(runAllSweeps, 8_000);

  console.log('SLA scheduler started (hourly assignment-breach + coordinator pre-breach sweeps + boot catch-up).');
};
