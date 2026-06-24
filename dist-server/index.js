import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbConnection } from './config/db.js';
import apiRouter from './routes/api.routes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;
// Initialize Database on server boot
getDbConnection()
    .then(() => console.log('Database initialized successfully.'))
    .catch(err => console.error('Failed to initialize database on startup:', err));
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Serving static files from: ${distPath}`);
});
