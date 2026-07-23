import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbConnection } from './config/db.js';
import apiRouter from './routes/api.routes.js';
import { startLeaveScheduler } from './jobs/leave.scheduler.js';
import { startSlaScheduler } from './jobs/sla.scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Database on server boot
getDbConnection()
  .then(() => console.log('Database initialized successfully.'))
  .catch(err => console.error('Failed to initialize database on startup:', err));

// Daily leave sweep (expiry, reminders, acting-coordinator activation/reversion)
startLeaveScheduler();

// Hourly assignment-SLA sweep (breach alerts to national roles + timeline record)
startSlaScheduler();

// Middleware — the JSON limit accommodates base64 attachment uploads
// (15 MB binary ≈ 20 MB base64, see server/services/fileStorage.service.ts)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.use('/api', apiRouter);

// Serve frontend build static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing (SPA)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  next();
});

// Last-resort error handler — anything that slips past controller try/catch
// must still produce a JSON body, never an empty/HTML response the SPA can't parse.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.url}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// A rejected fire-and-forget promise (email fan-out, schedulers) must not take
// down the process mid-request — that severs in-flight responses and surfaces
// in the browser as "Unexpected end of JSON input".
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from: ${distPath}`);
});
