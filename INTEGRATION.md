# Offline SCORM Player - Integration Guide

## Overview

This guide explains how to integrate the Offline SCORM Player with your LMS or use it as a standalone solution. The system is designed with the [scorm-again library](https://github.com/jcputney/scorm-again) at its core.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (PWA)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SCORM Content (iframe)                               │  │
│  │  - Calls API.LMSInitialize()                         │  │
│  │  - Calls API.LMSSetValue()                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  scorm-again Runtime API                             │  │
│  │  - Implements SCORM 1.2 / 2004 API                   │  │
│  │  - Validates data model                              │  │
│  │  - Manages CMI data                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Offline Storage Layer                               │  │
│  │  - IndexedDB (CMI data)                             │  │
│  │  - LocalStorage (session state)                      │  │
│  │  - Service Worker (caching)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑ (when online)
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server (Node.js)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  REST API                                            │  │
│  │  - /api/packages (upload, manage)                    │  │
│  │  - /api/scorm (session, commit)                      │  │
│  │  - /api/sync (offline sync)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services                                            │  │
│  │  - Package Handler (extract, parse)                  │  │
│  │  - SCORM Parser (imsmanifest.xml)                   │  │
│  │  - SCORM API Service (sessions, CMI)                │  │
│  │  - Offline Sync Service (queue, retry)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database (SQLite)                                   │  │
│  │  - packages, scorm_sessions                          │  │
│  │  - cmi_data, interactions                            │  │
│  │  - sync_queue                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:
- **scorm-again**: The SCORM runtime library
- **express**: Web server framework
- **better-sqlite3**: Database for tracking
- **adm-zip**: SCORM package extraction
- **xml2js**: Manifest parsing
- **multer**: File upload handling

### 2. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start at `http://localhost:3000`

## Integration with scorm-again

### Server-Side Integration

The backend uses scorm-again concepts but doesn't directly run the library server-side. Instead, it:

1. **Parses SCORM packages** to extract metadata
2. **Stores CMI data** in SQLite database
3. **Provides REST API** for the client-side scorm-again runtime

### Client-Side Integration

The client uses scorm-again to provide the SCORM API:

```javascript
// Example: Initialize SCORM 2004 API
import { Scorm2004API } from 'scorm-again';

const api = new Scorm2004API({
  autocommit: true,
  autocommitSeconds: 10,
  lmsCommitUrl: 'http://localhost:3000/api/scorm/PACKAGE_ID/commit',
  enableOfflineSupport: true,
  logLevel: 'INFO',
  
  requestHandler: (commitObject) => {
    return {
      sessionId: currentSessionId,
      data: commitObject,
    };
  },
  
  responseHandler: async (response) => {
    const data = await response.json();
    return {
      result: data.success,
      errorCode: data.errorCode || 0,
    };
  },
});

// Attach to window for SCORM content discovery
window.API_1484_11 = api;
```

## Usage Examples

### 1. Upload a SCORM Package

```bash
curl -X POST http://localhost:3000/api/packages/upload \
  -F "package=@course.zip"
```

Response:
```json
{
  "success": true,
  "packageId": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "title": "Introduction to JavaScript",
    "scormVersion": "2004",
    "launchPath": "index.html"
  }
}
```

### 2. Launch a Course

```html
<!DOCTYPE html>
<html>
<head>
    <title>SCORM Player</title>
    <script src="https://cdn.jsdelivr.net/npm/scorm-again@latest/dist/scorm2004.min.js"></script>
</head>
<body>
    <iframe id="scorm-content" src=""></iframe>
    
    <script>
        const packageId = 'YOUR_PACKAGE_ID';
        const sessionId = null;
        
        // Initialize SCORM API
        window.API_1484_11 = new Scorm2004API({
            autocommit: true,
            lmsCommitUrl: `http://localhost:3000/api/scorm/${packageId}/commit`,
            requestHandler: (commitObject) => ({
                sessionId: sessionId,
                data: commitObject,
            }),
        });
        
        // Initialize session
        fetch(`http://localhost:3000/api/scorm/${packageId}/initialize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'user123' }),
        })
        .then(res => res.json())
        .then(data => {
            sessionId = data.sessionId;
            
            // Get launch URL
            return fetch(`http://localhost:3000/api/packages/${packageId}/launch`);
        })
        .then(res => res.json())
        .then(data => {
            // Load SCORM content
            document.getElementById('scorm-content').src = data.launchUrl;
        });
    </script>
</body>
</html>
```

### 3. Download Package for Offline Use

```bash
curl -O http://localhost:3000/api/packages/PACKAGE_ID/download
```

This downloads a ZIP file containing:
- The complete SCORM package
- `offline-player.html` (standalone player)
- `offline-config.json` (configuration)

The offline bundle includes scorm-again from CDN and works completely offline.

## Offline Functionality

### How Offline Works

1. **Service Worker** caches SCORM content and API responses
2. **IndexedDB** stores CMI data locally
3. **LocalStorage** maintains session state
4. **Sync Queue** tracks pending commits for when connection restored

### Enabling Offline Support

```javascript
const player = new ScormPlayerClient({
    apiBaseUrl: 'http://localhost:3000/api',
    packageId: 'PACKAGE_ID',
    userId: 'USER_ID',
    scormVersion: '2004',
    enableOffline: true,  // Enable offline support
});
```

### Background Sync

When the device comes back online:

```javascript
// Automatic sync via Service Worker
navigator.serviceWorker.ready.then(registration => {
    return registration.sync.register('sync-scorm-data');
});

// Or manual sync
fetch('http://localhost:3000/api/sync/trigger', {
    method: 'POST',
});
```

## LMS Integration

### Moodle Integration

To integrate with Moodle:

1. **Install as External Tool (LTI)**: Use the REST API endpoints
2. **Custom Plugin**: Create a Moodle plugin that proxies to this backend
3. **Standalone**: Deploy separately and link from Moodle activities

### Data Flow

```
Moodle → Launch → Your Backend → SCORM Player → scorm-again → CMI Data → Your Backend → Moodle
```

### Example: Moodle Plugin Integration

```php
// In your Moodle plugin
function launch_scorm_player($packageid, $userid) {
    $api_url = 'http://localhost:3000/api';
    
    // Initialize session on backend
    $session = http_post("$api_url/scorm/$packageid/initialize", [
        'userId' => $userid
    ]);
    
    // Get launch URL
    $launch_url = "$api_url/packages/$packageid/launch";
    
    // Embed in iframe with SCORM API
    return render_player_iframe($launch_url, $session->sessionId);
}
```

## API Reference

### Package Endpoints

- `POST /api/packages/upload` - Upload SCORM package
- `GET /api/packages` - List all packages
- `GET /api/packages/:id` - Get package details
- `DELETE /api/packages/:id` - Delete package
- `GET /api/packages/:id/launch` - Get launch URL
- `GET /api/packages/:id/download` - Download offline bundle
- `GET /api/packages/:id/content/*` - Serve package files

### SCORM API Endpoints

- `POST /api/scorm/:packageId/initialize` - Start session
- `POST /api/scorm/:packageId/commit` - Commit CMI data
- `POST /api/scorm/:packageId/terminate` - End session
- `GET /api/scorm/:packageId/get/:element` - Get CMI value
- `POST /api/scorm/:packageId/set/:element` - Set CMI value

### Sync Endpoints

- `POST /api/sync/upload` - Upload offline session data
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/trigger` - Manually trigger sync

## Best Practices

### 1. Always Initialize Session

Before launching content, initialize a session:

```javascript
const response = await fetch(`/api/scorm/${packageId}/initialize`, {
    method: 'POST',
    body: JSON.stringify({ userId: 'USER_ID' }),
});
const { sessionId } = await response.json();
```

### 2. Handle Offline Gracefully

```javascript
window.addEventListener('offline', () => {
    console.log('Offline mode - data will sync when online');
    showOfflineIndicator();
});

window.addEventListener('online', () => {
    console.log('Online - syncing data...');
    triggerSync();
});
```

### 3. Use Service Worker for Caching

Include the service worker in your player:

```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}
```

### 4. Validate SCORM Packages

Always validate packages before processing:

```javascript
const validation = await packageHandler.validatePackage(filePath);
if (!validation.valid) {
    throw new Error(validation.error);
}
```

## Troubleshooting

### SCORM Content Can't Find API

**Issue**: Module shows "API not found" error

**Solution**: Ensure the API is attached to `window`:
```javascript
window.API = new Scorm12API(settings);  // SCORM 1.2
// OR
window.API_1484_11 = new Scorm2004API(settings);  // SCORM 2004
```

### Data Not Syncing Offline

**Issue**: Offline data not syncing when connection restored

**Solution**: Check service worker registration and sync queue:
```javascript
// Check sync queue status
const status = await fetch('/api/sync/status').then(r => r.json());
console.log('Pending sync items:', status.status.pending);

// Manually trigger sync
await fetch('/api/sync/trigger', { method: 'POST' });
```

### Package Upload Fails

**Issue**: Package upload returns error

**Solution**: Check package size and format:
```bash
# Check package size (default limit: 500MB)
ls -lh course.zip

# Verify it's a valid ZIP
unzip -t course.zip

# Check for manifest
unzip -l course.zip | grep imsmanifest.xml
```

## Resources

- [scorm-again Documentation](https://jcputney.github.io/scorm-again/)
- [SCORM 2004 4th Edition Specification](https://adlnet.gov/projects/scorm/)
- [Moodle SCORM Player Reference](https://docs.moodle.org/en/SCORM)
- [Progressive Web Apps Guide](https://web.dev/progressive-web-apps/)

## License

MIT License - See LICENSE file for details
