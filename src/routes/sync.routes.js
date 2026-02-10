import express from 'express';
import syncController from '../controllers/sync.controller.js';

const router = express.Router();

// Sync operations
router.post('/upload', (req, res) => 
  syncController.uploadOfflineData(req, res)
);

router.get('/status', (req, res) => 
  syncController.getSyncStatus(req, res)
);

router.post('/trigger', (req, res) => 
  syncController.triggerSync(req, res)
);

router.post('/auto-sync/start', (req, res) => 
  syncController.startAutoSync(req, res)
);

router.post('/auto-sync/stop', (req, res) => 
  syncController.stopAutoSync(req, res)
);

export default router;
