import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/config.js';
import packageRoutes from './routes/package.routes.js';
import scormRoutes from './routes/scorm.routes.js';
import syncRoutes from './routes/sync.routes.js';
import { 
  errorHandler, 
  notFoundHandler, 
  requestLogger 
} from './middleware/error-handler.js';
import { ensureDir } from './utils/file-system.js';
import offlineSyncService from './services/offline-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize storage directories
async function initializeServer() {
  await ensureDir(config.paths.packages);
  await ensureDir(config.paths.uploads);
  await ensureDir(config.paths.database);
  
  console.log('Storage directories initialized');
  
  // Start auto-sync service
  offlineSyncService.startAutoSync(60000); // Sync every minute
  console.log('Auto-sync service started');
}

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Serve static files (for PWA and player)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/packages', packageRoutes);
app.use('/api/scorm', scormRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    name: 'Offline SCORM Player API',
    version: '1.0.0',
    endpoints: {
      packages: {
        upload: 'POST /api/packages/upload',
        list: 'GET /api/packages',
        get: 'GET /api/packages/:id',
        delete: 'DELETE /api/packages/:id',
        launch: 'GET /api/packages/:id/launch',
        download: 'GET /api/packages/:id/download',
        content: 'GET /api/packages/:id/content/*',
      },
      scorm: {
        initialize: 'POST /api/scorm/:packageId/initialize',
        commit: 'POST /api/scorm/:packageId/commit',
        terminate: 'POST /api/scorm/:packageId/terminate',
        getValue: 'GET /api/scorm/:packageId/get/:element',
        setValue: 'POST /api/scorm/:packageId/set/:element',
        getSession: 'GET /api/scorm/session/:sessionId',
        packageSessions: 'GET /api/scorm/package/:packageId/sessions',
        userSessions: 'GET /api/scorm/user/:userId/sessions',
      },
      sync: {
        upload: 'POST /api/sync/upload',
        status: 'GET /api/sync/status',
        trigger: 'POST /api/sync/trigger',
        startAutoSync: 'POST /api/sync/auto-sync/start',
        stopAutoSync: 'POST /api/sync/auto-sync/stop',
      },
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await initializeServer();
    
    app.listen(config.port, config.host, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Offline SCORM Player Backend                            ║
║                                                            ║
║   Server running at: http://${config.host}:${config.port}           ║
║   API documentation: http://${config.host}:${config.port}/api     ║
║                                                            ║
║   Ready to accept SCORM packages!                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  offlineSyncService.stopAutoSync();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  offlineSyncService.stopAutoSync();
  process.exit(0);
});

// Start the server
startServer();

export default app;
