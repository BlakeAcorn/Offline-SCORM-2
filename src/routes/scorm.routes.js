import express from 'express';
import scormController from '../controllers/scorm.controller.js';

const router = express.Router();

// Session management
router.post('/:packageId/initialize', (req, res) => 
  scormController.initializeSession(req, res)
);

router.post('/:packageId/commit', (req, res) => 
  scormController.commit(req, res)
);

router.post('/:packageId/terminate', (req, res) => 
  scormController.terminateSession(req, res)
);

// CMI data access
router.get('/:packageId/get/:element(*)', (req, res) => 
  scormController.getValue(req, res)
);

router.post('/:packageId/set/:element(*)', (req, res) => 
  scormController.setValue(req, res)
);

// Session queries
router.get('/session/:sessionId', (req, res) => 
  scormController.getSession(req, res)
);

router.get('/package/:packageId/sessions', (req, res) => 
  scormController.getPackageSessions(req, res)
);

router.get('/user/:userId/sessions', (req, res) => 
  scormController.getUserSessions(req, res)
);

export default router;
