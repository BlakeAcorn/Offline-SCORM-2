import offlineSyncService from '../services/offline-sync.js';

export class SyncController {
  /**
   * Upload offline session data
   */
  async uploadOfflineData(req, res) {
    try {
      const { sessionId, packageId, actions } = req.body;

      if (!sessionId || !packageId || !actions) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, packageId, actions',
        });
      }

      const result = await offlineSyncService.uploadOfflineSession({
        sessionId,
        packageId,
        actions,
      });

      res.json(result);
    } catch (error) {
      console.error('Upload offline data error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(req, res) {
    try {
      const status = offlineSyncService.getSyncStatus();

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Trigger manual sync
   */
  async triggerSync(req, res) {
    try {
      const result = await offlineSyncService.triggerSync();

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Trigger sync error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Start auto-sync
   */
  async startAutoSync(req, res) {
    try {
      const { interval } = req.body;
      
      offlineSyncService.startAutoSync(interval);

      res.json({
        success: true,
        message: 'Auto-sync started',
      });
    } catch (error) {
      console.error('Start auto-sync error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Stop auto-sync
   */
  async stopAutoSync(req, res) {
    try {
      offlineSyncService.stopAutoSync();

      res.json({
        success: true,
        message: 'Auto-sync stopped',
      });
    } catch (error) {
      console.error('Stop auto-sync error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new SyncController();
