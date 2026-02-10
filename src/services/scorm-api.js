import { v4 as uuidv4 } from 'uuid';
import { statements } from '../models/database.js';

/**
 * SCORM API Service
 * Handles SCORM runtime API interactions and data storage
 */
export class ScormApiService {
  /**
   * Initialize a new SCORM session
   */
  initializeSession(packageId, userId = null) {
    const sessionId = uuidv4();

    try {
      statements.insertSession.run(sessionId, packageId, userId);
      
      return {
        success: true,
        sessionId,
        packageId,
        userId,
      };
    } catch (error) {
      throw new Error(`Failed to initialize session: ${error.message}`);
    }
  }

  /**
   * Get session data
   */
  getSession(sessionId) {
    const session = statements.getSession.get(sessionId);
    
    if (!session) {
      return null;
    }

    return session;
  }

  /**
   * Get CMI data for session
   */
  getCmiData(sessionId, element = null) {
    if (element) {
      const data = statements.getCmiData.get(sessionId, element);
      return data ? data.value : null;
    }

    // Get all CMI data
    const allData = statements.getAllCmiData.all(sessionId);
    
    // Build CMI object from flat data
    const cmi = {};
    for (const item of allData) {
      this.setNestedValue(cmi, item.element, item.value);
    }

    return cmi;
  }

  /**
   * Set CMI data value
   */
  setCmiData(sessionId, element, value) {
    try {
      statements.insertCmiData.run(sessionId, element, value);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to set CMI data: ${error.message}`);
    }
  }

  /**
   * Commit SCORM data
   */
  commitSession(sessionId, commitData) {
    try {
      const session = this.getSession(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Extract common fields
      const completed = this.determineCompletion(commitData);
      const successStatus = commitData.cmi?.success_status || 
                           commitData.cmi?.core?.lesson_status || 
                           null;
      const scoreRaw = commitData.cmi?.score?.raw || 
                      commitData.cmi?.core?.score?.raw || 
                      null;
      const sessionTime = commitData.cmi?.session_time || 
                         commitData.cmi?.core?.session_time || 
                         null;
      const totalTime = commitData.cmi?.total_time || 
                       commitData.cmi?.core?.total_time || 
                       null;
      const suspendData = commitData.cmi?.suspend_data || 
                         commitData.cmi?.core?.suspend_data || 
                         null;

      // Update session
      statements.updateSession.run(
        completed ? 1 : 0,
        successStatus,
        scoreRaw,
        sessionTime,
        totalTime,
        suspendData,
        sessionId
      );

      // Store all CMI data
      this.storeCmiData(sessionId, commitData.cmi || {});

      // Store interactions if present
      if (commitData.cmi?.interactions) {
        this.storeInteractions(sessionId, commitData.cmi.interactions);
      }

      return {
        success: true,
        sessionId,
        committed: true,
      };
    } catch (error) {
      throw new Error(`Failed to commit session: ${error.message}`);
    }
  }

  /**
   * Terminate SCORM session
   */
  terminateSession(sessionId, finalData = {}) {
    try {
      // Commit final data
      if (Object.keys(finalData).length > 0) {
        this.commitSession(sessionId, finalData);
      }

      return {
        success: true,
        sessionId,
        terminated: true,
      };
    } catch (error) {
      throw new Error(`Failed to terminate session: ${error.message}`);
    }
  }

  /**
   * Store all CMI data from commit object
   */
  storeCmiData(sessionId, cmi, prefix = 'cmi') {
    for (const [key, value] of Object.entries(cmi)) {
      const element = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively handle nested objects
        this.storeCmiData(sessionId, value, element);
      } else if (Array.isArray(value)) {
        // Handle arrays (like interactions, objectives)
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            this.storeCmiData(sessionId, item, `${element}.${index}`);
          } else {
            this.setCmiData(sessionId, `${element}.${index}`, String(item));
          }
        });
      } else {
        // Store primitive values
        this.setCmiData(sessionId, element, String(value));
      }
    }
  }

  /**
   * Store interactions
   */
  storeInteractions(sessionId, interactions) {
    if (!Array.isArray(interactions)) {
      interactions = Object.values(interactions);
    }

    for (const interaction of interactions) {
      if (!interaction.id) continue;

      statements.insertInteraction.run(
        sessionId,
        interaction.id,
        interaction.type || null,
        interaction.timestamp ? new Date(interaction.timestamp).getTime() : null,
        interaction.correct_responses ? JSON.stringify(interaction.correct_responses) : null,
        interaction.learner_response || null,
        interaction.result || null,
        interaction.latency || null,
        interaction.description || null
      );
    }
  }

  /**
   * Determine completion status
   */
  determineCompletion(commitData) {
    const cmi = commitData.cmi || {};

    // SCORM 2004
    if (cmi.completion_status) {
      return cmi.completion_status === 'completed';
    }

    // SCORM 1.2
    if (cmi.core?.lesson_status) {
      const status = cmi.core.lesson_status;
      return status === 'completed' || status === 'passed';
    }

    return false;
  }

  /**
   * Get sessions by package
   */
  getSessionsByPackage(packageId) {
    return statements.getSessionsByPackage.all(packageId);
  }

  /**
   * Get sessions by user
   */
  getSessionsByUser(userId) {
    return statements.getSessionsByUser.all(userId);
  }

  /**
   * Get interactions for session
   */
  getInteractions(sessionId) {
    const interactions = statements.getInteractions.all(sessionId);
    
    return interactions.map(interaction => ({
      ...interaction,
      correct_responses: interaction.correct_responses 
        ? JSON.parse(interaction.correct_responses) 
        : null,
    }));
  }

  /**
   * Load initial CMI data for session
   * Used when resuming a session
   */
  loadInitialData(sessionId) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    const cmiData = this.getCmiData(sessionId);
    const interactions = this.getInteractions(sessionId);

    return {
      session,
      cmi: cmiData,
      interactions,
    };
  }

  /**
   * Helper: Set nested object value from dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      // Handle array indices
      if (!isNaN(key)) {
        const index = parseInt(key);
        if (!Array.isArray(current)) {
          return;
        }
        if (!current[index]) {
          current[index] = {};
        }
        current = current[index];
      } else {
        if (!current[key]) {
          // Check if next key is a number (array)
          const nextKey = keys[i + 1];
          current[key] = !isNaN(nextKey) ? [] : {};
        }
        current = current[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * Create offline sync item
   */
  createSyncItem(sessionId, packageId, action, data) {
    try {
      statements.insertSyncItem.run(
        sessionId,
        packageId,
        action,
        JSON.stringify(data)
      );
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to create sync item: ${error.message}`);
    }
  }

  /**
   * Get pending sync items
   */
  getPendingSyncItems(batchSize = 100) {
    return statements.getPendingSync.all(batchSize);
  }

  /**
   * Mark sync item as synced
   */
  markSyncItemSynced(syncItemId) {
    try {
      statements.markSynced.run(syncItemId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to mark sync item: ${error.message}`);
    }
  }

  /**
   * Increment retry count for sync item
   */
  incrementSyncRetry(syncItemId) {
    try {
      statements.incrementRetry.run(syncItemId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to increment retry: ${error.message}`);
    }
  }
}

export default new ScormApiService();
