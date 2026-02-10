import scormApiService from '../services/scorm-api.js';
import packageHandler from '../services/package-handler.js';

export class ScormController {
  /**
   * Initialize SCORM session
   */
  async initializeSession(req, res) {
    try {
      const { packageId } = req.params;
      const { userId } = req.body;

      // Verify package exists
      const pkg = packageHandler.getPackage(packageId);
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found',
        });
      }

      // Initialize session
      const result = scormApiService.initializeSession(packageId, userId);

      // Load initial data if resuming
      const initialData = req.body.resume ? 
        scormApiService.loadInitialData(result.sessionId) : 
        null;

      res.json({
        ...result,
        initialData,
      });
    } catch (error) {
      console.error('Initialize session error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get CMI value
   */
  async getValue(req, res) {
    try {
      const { packageId, element } = req.params;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID required',
        });
      }

      const value = scormApiService.getCmiData(sessionId, element);

      res.json({
        success: true,
        element,
        value,
      });
    } catch (error) {
      console.error('Get value error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Set CMI value
   */
  async setValue(req, res) {
    try {
      const { packageId, element } = req.params;
      const { sessionId, value } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID required',
        });
      }

      const result = scormApiService.setCmiData(sessionId, element, value);

      res.json({
        ...result,
        element,
        value,
      });
    } catch (error) {
      console.error('Set value error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Commit SCORM data
   */
  async commit(req, res) {
    try {
      const { packageId } = req.params;
      const { sessionId, data } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID required',
        });
      }

      const result = scormApiService.commitSession(sessionId, data || {});

      res.json(result);
    } catch (error) {
      console.error('Commit error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        errorCode: 101, // SCORM error code for general exception
      });
    }
  }

  /**
   * Terminate SCORM session
   */
  async terminateSession(req, res) {
    try {
      const { packageId } = req.params;
      const { sessionId, data } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID required',
        });
      }

      const result = scormApiService.terminateSession(sessionId, data || {});

      res.json(result);
    } catch (error) {
      console.error('Terminate session error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get session data
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = scormApiService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
        });
      }

      const cmiData = scormApiService.getCmiData(sessionId);
      const interactions = scormApiService.getInteractions(sessionId);

      res.json({
        success: true,
        session,
        cmi: cmiData,
        interactions,
      });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get sessions by package
   */
  async getPackageSessions(req, res) {
    try {
      const { packageId } = req.params;

      const sessions = scormApiService.getSessionsByPackage(packageId);

      res.json({
        success: true,
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      console.error('Get package sessions error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get sessions by user
   */
  async getUserSessions(req, res) {
    try {
      const { userId } = req.params;

      const sessions = scormApiService.getSessionsByUser(userId);

      res.json({
        success: true,
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new ScormController();
