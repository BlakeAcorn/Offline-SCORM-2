import config from '../config/config.js';
import scormApiService from '../services/scorm-api.js';

/**
 * Offline Sync Service
 * Handles synchronization of offline SCORM data
 */
export class OfflineSyncService {
  constructor() {
    this.syncing = false;
    this.syncInterval = null;
  }

  /**
   * Start automatic sync process
   */
  startAutoSync(intervalMs = 60000) {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, intervalMs);

    console.log(`Auto-sync started with interval: ${intervalMs}ms`);
  }

  /**
   * Stop automatic sync process
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Process sync queue
   */
  async processSyncQueue() {
    if (this.syncing) {
      return { status: 'already_syncing' };
    }

    this.syncing = true;

    try {
      const pendingItems = scormApiService.getPendingSyncItems(config.sync.batchSize);

      if (pendingItems.length === 0) {
        return { status: 'no_items', synced: 0 };
      }

      console.log(`Processing ${pendingItems.length} sync items`);

      let successCount = 0;
      let errorCount = 0;

      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          scormApiService.markSyncItemSynced(item.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error.message);
          
          // Increment retry count
          scormApiService.incrementSyncRetry(item.id);
          errorCount++;

          // Check if max retries exceeded
          if (item.retry_count >= config.sync.maxRetries) {
            console.error(`Max retries exceeded for sync item ${item.id}`);
          }
        }
      }

      return {
        status: 'completed',
        synced: successCount,
        errors: errorCount,
        total: pendingItems.length,
      };
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Process individual sync item
   */
  async processSyncItem(item) {
    const data = JSON.parse(item.data);

    switch (item.action) {
      case 'commit':
        await this.syncCommit(item.session_id, item.package_id, data);
        break;

      case 'initialize':
        await this.syncInitialize(item.session_id, item.package_id, data);
        break;

      case 'terminate':
        await this.syncTerminate(item.session_id, item.package_id, data);
        break;

      default:
        console.warn(`Unknown sync action: ${item.action}`);
    }
  }

  /**
   * Sync commit data to external LMS
   */
  async syncCommit(sessionId, packageId, data) {
    // In a real implementation, this would send data to an external LMS
    // For now, we just log it
    console.log(`Syncing commit for session ${sessionId}:`, data);

    // Example: Send to external LMS endpoint
    // const response = await fetch('https://lms.example.com/api/scorm/commit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     sessionId,
    //     packageId,
    //     data
    //   })
    // });
    // 
    // if (!response.ok) {
    //   throw new Error('Failed to sync commit');
    // }

    return { success: true };
  }

  /**
   * Sync initialize data
   */
  async syncInitialize(sessionId, packageId, data) {
    console.log(`Syncing initialize for session ${sessionId}`);
    return { success: true };
  }

  /**
   * Sync terminate data
   */
  async syncTerminate(sessionId, packageId, data) {
    console.log(`Syncing terminate for session ${sessionId}`);
    return { success: true };
  }

  /**
   * Upload offline session data
   */
  async uploadOfflineSession(offlineData) {
    try {
      const { sessionId, packageId, actions } = offlineData;

      // Create sync items for each action
      for (const action of actions) {
        scormApiService.createSyncItem(
          sessionId,
          packageId,
          action.type,
          action.data
        );
      }

      // Trigger immediate sync
      await this.processSyncQueue();

      return {
        success: true,
        message: 'Offline session data queued for synchronization',
      };
    } catch (error) {
      throw new Error(`Failed to upload offline session: ${error.message}`);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const pendingItems = scormApiService.getPendingSyncItems(1000);
    
    const stats = {
      pending: pendingItems.length,
      syncing: this.syncing,
      autoSyncEnabled: this.syncInterval !== null,
      byAction: {},
    };

    // Count by action type
    for (const item of pendingItems) {
      stats.byAction[item.action] = (stats.byAction[item.action] || 0) + 1;
    }

    return stats;
  }

  /**
   * Manual sync trigger
   */
  async triggerSync() {
    return await this.processSyncQueue();
  }

  /**
   * Clear all pending sync items (admin function)
   */
  clearPendingSync() {
    // This would require a new database statement
    // For now, just return a warning
    return {
      success: false,
      message: 'Clear pending sync not implemented - use database directly',
    };
  }
}

export default new OfflineSyncService();
