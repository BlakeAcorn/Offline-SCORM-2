# Offline SCORM Player

A backend system for hosting SCORM modules with offline capability, designed for LMS integration and PWA deployment.

## Architecture Overview

This system is designed with an **offline-first** approach, allowing SCORM content to be:
1. Uploaded and processed on a server
2. Downloaded to local devices
3. Played completely offline without internet connection
4. Synchronized back to the server when online

### Key Features

- **SCORM 1.2 and SCORM 2004 Support**: Parse and host both versions
- **Offline-First Design**: Complete functionality without internet
- **PWA Compatible**: Service worker integration for caching
- **Local Storage**: SQLite for tracking and state management
- **Package Management**: Upload, extract, and serve SCORM packages
- **API Adapter**: SCORM API implementation for tracking learner progress
- **Sync Mechanism**: Background synchronization when connection available

## Project Structure

```
offline-scorm-player/
├── src/
│   ├── server.js              # Express server entry point
│   ├── config/                # Configuration files
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   │   ├── scorm-parser.js    # Parse SCORM manifests
│   │   ├── package-handler.js # Handle package operations
│   │   └── scorm-api.js       # SCORM API implementation
│   ├── models/                # Data models
│   ├── routes/                # API routes
│   ├── middleware/            # Express middleware
│   └── utils/                 # Helper functions
├── storage/
│   ├── packages/              # Extracted SCORM packages
│   ├── uploads/               # Temporary upload directory
│   └── db/                    # SQLite databases
├── public/                    # Static files for PWA
│   └── service-worker.js      # Service worker for offline caching
└── package.json
```

## SCORM Offline Architecture

### How It Works

1. **Server Side (Online)**:
   - Accepts SCORM package uploads
   - Extracts and parses manifest (imsmanifest.xml)
   - Stores package metadata in SQLite
   - Serves packages via REST API

2. **Client Side (PWA)**:
   - Downloads SCORM packages
   - Stores content in IndexedDB/Cache API
   - Runs SCORM content locally
   - Tracks progress in local SQLite/IndexedDB
   - Syncs data when online

3. **SCORM API Bridge**:
   - Implements SCORM Runtime API
   - Stores CMI data locally
   - Queues sync operations
   - Provides fallback for offline mode

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Package Management

- `POST /api/packages/upload` - Upload SCORM package
- `GET /api/packages` - List all packages
- `GET /api/packages/:id` - Get package details
- `GET /api/packages/:id/launch` - Get launch URL
- `DELETE /api/packages/:id` - Delete package
- `GET /api/packages/:id/download` - Download package for offline use

### SCORM API

- `POST /api/scorm/:packageId/initialize` - Initialize SCORM session
- `POST /api/scorm/:packageId/commit` - Commit CMI data
- `POST /api/scorm/:packageId/terminate` - Terminate session
- `GET /api/scorm/:packageId/get/:element` - Get CMI value
- `POST /api/scorm/:packageId/set/:element` - Set CMI value

### Sync

- `POST /api/sync/upload` - Upload offline session data
- `GET /api/sync/status` - Check sync status

## SCORM Standards Compliance

This player supports:
- **SCORM 1.2**: Complete API implementation
- **SCORM 2004** (3rd/4th Edition): Full support

### Supported CMI Elements

All standard SCORM data model elements including:
- `cmi.core.*` (SCORM 1.2)
- `cmi.learner_*` (SCORM 2004)
- `cmi.score.*`
- `cmi.suspend_data`
- `cmi.interactions.*`

## Offline Synchronization

The system implements a queue-based sync mechanism:

1. All SCORM API calls are logged locally
2. When online, data is pushed to server
3. Conflicts are resolved server-side
4. Background sync API for automatic syncing

## Browser Support

- Chrome/Edge (Chromium) 90+
- Firefox 88+
- Safari 14+

Requires:
- Service Workers
- IndexedDB
- Cache API
- Background Sync API (optional)

## Reference Implementation

This implementation draws inspiration from:
- Moodle SCORM Player
- SCORM Cloud by Rustici Software
- ADL SCORM specifications

## License

MIT
