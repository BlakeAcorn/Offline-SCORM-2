/**
 * SCORM Player Client
 * Integrates with scorm-again library for offline SCORM playback
 */

import Scorm12API from 'scorm-again/scorm12';
import Scorm2004API from 'scorm-again/scorm2004';

class ScormPlayerClient {
  constructor(config = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
      packageId: config.packageId,
      userId: config.userId || null,
      scormVersion: config.scormVersion || '2004',
      enableOffline: config.enableOffline !== false,
      ...config,
    };

    this.sessionId = null;
    this.scormApi = null;
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;

    this.initialize();
  }

  /**
   * Initialize the SCORM player
   */
  async initialize() {
    // Set up online/offline listeners
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initialize SCORM API
    await this.initializeScormApi();

    // Load persisted data if offline
    if (!this.isOnline && this.config.enableOffline) {
      await this.loadOfflineData();
    }

    console.log('SCORM Player Client initialized');
  }

  /**
   * Initialize SCORM API with scorm-again library
   */
  async initializeScormApi() {
    const apiSettings = {
      autocommit: true,
      autocommitSeconds: 10,
      lmsCommitUrl: `${this.config.apiBaseUrl}/scorm/${this.config.packageId}/commit`,
      logLevel: 'INFO',
      
      // Use async commits only for online mode
      useAsynchronousCommits: this.isOnline,
      throttleCommits: this.isOnline,
      
      // Custom request handler to include session ID
      requestHandler: (commitObject) => {
        return {
          sessionId: this.sessionId,
          data: commitObject,
        };
      },

      // Custom response handler
      responseHandler: async (response) => {
        const data = await response.json();
        return {
          result: data.success || false,
          errorCode: data.errorCode || 0,
        };
      },

      // XHR headers for authentication
      xhrHeaders: {
        'Content-Type': 'application/json',
      },
    };

    // Create appropriate API version
    if (this.config.scormVersion === '1.2') {
      this.scormApi = new Scorm12API(apiSettings);
      window.API = this.scormApi;
    } else {
      this.scormApi = new Scorm2004API(apiSettings);
      window.API_1484_11 = this.scormApi;
    }

    // Set up event listeners
    this.setupScormEventListeners();
  }

  /**
   * Set up SCORM API event listeners
   */
  setupScormEventListeners() {
    const initEvent = this.config.scormVersion === '1.2' ? 'LMSInitialize' : 'Initialize';
    const commitEvent = this.config.scormVersion === '1.2' ? 'LMSCommit' : 'Commit';
    const terminateEvent = this.config.scormVersion === '1.2' ? 'LMSFinish' : 'Terminate';

    // Initialize
    this.scormApi.on(initEvent, async () => {
      console.log('SCORM session initialized');
      await this.handleInitialize();
    });

    // Commit
    this.scormApi.on(commitEvent, async () => {
      console.log('SCORM data committed');
      
      if (!this.isOnline && this.config.enableOffline) {
        await this.queueOfflineCommit();
      }
    });

    // Terminate
    this.scormApi.on(terminateEvent, async () => {
      console.log('SCORM session terminated');
      await this.handleTerminate();
    });

    // Listen for all SetValue calls to persist offline
    const setValueEvent = this.config.scormVersion === '1.2' ? 'LMSSetValue.*' : 'SetValue.*';
    this.scormApi.on(setValueEvent, async (element, value) => {
      if (!this.isOnline && this.config.enableOffline) {
        await this.persistOffline(element, value);
      }
    });
  }

  /**
   * Handle SCORM initialize
   */
  async handleInitialize() {
    if (this.isOnline) {
      try {
        const response = await fetch(`${this.config.apiBaseUrl}/scorm/${this.config.packageId}/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            resume: false,
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          this.sessionId = data.sessionId;
          
          // Load initial data if resuming
          if (data.initialData) {
            this.scormApi.loadFromJSON(data.initialData.cmi);
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        
        if (this.config.enableOffline) {
          console.log('Running in offline mode');
          this.sessionId = this.generateOfflineSessionId();
        }
      }
    } else {
      // Offline mode
      this.sessionId = this.generateOfflineSessionId();
      console.log('Running in offline mode');
    }
  }

  /**
   * Handle SCORM terminate
   */
  async handleTerminate() {
    if (!this.isOnline && this.config.enableOffline) {
      await this.saveOfflineData();
    }

    if (this.isOnline && this.sessionId) {
      try {
        await fetch(`${this.config.apiBaseUrl}/scorm/${this.config.packageId}/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            data: this.scormApi.renderCommitObject(),
          }),
        });
      } catch (error) {
        console.error('Failed to terminate session:', error);
      }
    }
  }

  /**
   * Queue offline commit for later sync
   */
  async queueOfflineCommit() {
    const commitData = this.scormApi.renderCommitObject();
    
    this.offlineQueue.push({
      type: 'commit',
      timestamp: Date.now(),
      data: commitData,
    });

    await this.saveOfflineQueue();
  }

  /**
   * Persist data offline using IndexedDB
   */
  async persistOffline(element, value) {
    const db = await this.getOfflineDatabase();
    const tx = db.transaction(['scormData'], 'readwrite');
    const store = tx.objectStore('scormData');

    await store.put({
      sessionId: this.sessionId,
      element,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Load offline data from IndexedDB
   */
  async loadOfflineData() {
    try {
      const db = await this.getOfflineDatabase();
      const tx = db.transaction(['scormData'], 'readonly');
      const store = tx.objectStore('scormData');
      const data = await store.getAll();

      if (data && data.length > 0) {
        const cmiData = {};
        
        for (const item of data) {
          this.setNestedValue(cmiData, item.element, item.value);
        }

        this.scormApi.loadFromJSON(cmiData);
        console.log('Loaded offline data');
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  }

  /**
   * Save offline data
   */
  async saveOfflineData() {
    try {
      const commitData = this.scormApi.renderCommitObject();
      localStorage.setItem(`scorm_offline_${this.sessionId}`, JSON.stringify(commitData));
      console.log('Saved offline data');
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }

  /**
   * Save offline queue
   */
  async saveOfflineQueue() {
    try {
      localStorage.setItem(
        `scorm_queue_${this.config.packageId}`,
        JSON.stringify(this.offlineQueue)
      );
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Load offline queue
   */
  async loadOfflineQueue() {
    try {
      const queueData = localStorage.getItem(`scorm_queue_${this.config.packageId}`);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Sync offline data when connection restored
   */
  async syncOfflineData() {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Syncing ${this.offlineQueue.length} offline items...`);

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/sync/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          packageId: this.config.packageId,
          actions: this.offlineQueue,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('Offline data synced successfully');
        this.offlineQueue = [];
        await this.saveOfflineQueue();
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  /**
   * Handle online event
   */
  async handleOnline() {
    console.log('Connection restored');
    this.isOnline = true;

    // Sync offline data
    await this.loadOfflineQueue();
    await this.syncOfflineData();

    // Register background sync
    if ('serviceWorker' in navigator && 'sync' in window.registration) {
      try {
        await window.registration.sync.register('sync-scorm-data');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('Connection lost - switching to offline mode');
    this.isOnline = false;
  }

  /**
   * Get IndexedDB instance
   */
  async getOfflineDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ScormOfflineDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('scormData')) {
          const store = db.createObjectStore('scormData', { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('element', 'element', { unique: false });
        }
      };
    });
  }

  /**
   * Generate offline session ID
   */
  generateOfflineSessionId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Set nested object value from dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!current[key]) {
        const nextKey = keys[i + 1];
        current[key] = !isNaN(nextKey) ? [] : {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }
}

export default ScormPlayerClient;
