# CLAUDE.md - AI Assistant Context for Offline SCORM Player

This file provides context for AI assistants (Claude, GitHub Copilot, etc.) working on this project.

---

## Project Overview

**Offline SCORM Player** is an offline-first SCORM content hosting system with Progressive Web App (PWA) capabilities. It allows users to upload SCORM packages, play them locally, and synchronize learner progress when connectivity is restored.

### Core Technology

- **Backend**: Node.js + Express + SQLite
- **SCORM Runtime**: [scorm-again](https://github.com/jcputney/scorm-again) library by jcputney
- **Frontend**: Vanilla JavaScript (no framework)
- **Storage**: SQLite for metadata, LocalStorage/IndexedDB for offline data
- **Architecture**: RESTful API with event-driven SCORM integration

---

## Project Structure

```
offline-scorm-player/
├── src/                              # Backend source
│   ├── server.js                    # Express server entry point
│   ├── config/config.js             # Centralized configuration
│   ├── controllers/                 # Request handlers
│   │   ├── package.controller.js    # Package CRUD operations
│   │   ├── scorm.controller.js      # SCORM API endpoints
│   │   └── sync.controller.js       # Offline sync management
│   ├── services/                    # Business logic layer
│   │   ├── scorm-parser.js          # Parse imsmanifest.xml
│   │   ├── package-handler.js       # Extract/manage packages
│   │   ├── scorm-api.js            # SCORM session management
│   │   └── offline-sync.js          # Sync queue processor
│   ├── models/database.js           # SQLite schema & queries
│   ├── routes/                      # Express routes
│   ├── middleware/error-handler.js  # Error handling
│   └── utils/file-system.js        # File operations
│
├── public/                          # Frontend/PWA
│   ├── index.html                  # Landing page
│   ├── upload.html                 # Package upload UI
│   ├── simple-player.html          # Basic SCORM player
│   ├── offline-player.html         # Full offline support
│   ├── test-player.html            # Advanced debugging
│   ├── service-worker.js           # PWA offline caching
│   └── scorm-player-client.js      # Client integration library
│
├── storage/                         # Runtime data (not in git)
│   ├── packages/                   # Extracted SCORM packages
│   ├── uploads/                    # Temporary uploads
│   └── db/                         # SQLite database files
│
└── Documentation (7 .md files)
```

---

## Key Design Decisions

### 1. **Offline-First Architecture**

The system is designed to work completely offline:
- SQLite provides local data persistence
- LocalStorage caches SCORM CMI data client-side
- Sync queue (`sync_queue` table) tracks offline actions
- Auto-sync service runs every 60 seconds when online

### 2. **scorm-again Integration**

We use [scorm-again](https://github.com/jcputney/scorm-again) as the SCORM runtime:
- Loaded from CDN (unpkg.com)
- Provides `Scorm12API` and `Scorm2004API` classes
- Handles all SCORM data model validation
- Event-driven architecture for tracking

**Important**: The API must be attached to `window.API` (SCORM 1.2) or `window.API_1484_11` (SCORM 2004) BEFORE SCORM content loads, or content will fail with "Unable to acquire LMS API".

### 3. **Multiple Player Options**

We provide several player implementations for different use cases:
- **simple-player.html**: Basic player, auto-loads latest package
- **offline-player.html**: Full offline support with sync
- **test-player.html**: Advanced debugging with console
- **api-wrapper.html**: Minimal wrapper for direct testing

### 4. **Database Schema**

SQLite with five main tables:
- `packages`: SCORM package metadata
- `scorm_sessions`: User sessions
- `cmi_data`: Flat key-value CMI storage
- `sync_queue`: Offline sync queue
- `interactions`: Detailed interaction tracking

---

## Code Conventions

### File Naming
- **Controllers**: `*.controller.js` - Handle HTTP requests
- **Services**: `*.js` in `services/` - Business logic
- **Routes**: `*.routes.js` - Express route definitions

### Module System
- **ES Modules** (`import/export`) throughout
- `"type": "module"` in package.json
- Use `.js` extension in imports

### Error Handling
- Try-catch in all async functions
- Consistent error response format:
  ```javascript
  {
    success: false,
    error: "Error message"
  }
  ```

### API Response Format
- Always return `success: true/false`
- Include relevant data in response
- Use HTTP status codes appropriately

---

## Critical Implementation Details

### SCORM Version Detection

Located: `src/services/scorm-parser.js` → `detectScormVersion()`

The parser checks multiple indicators in order:
1. `metadata.schemaversion` (most reliable)
2. SCORM 2004 namespaces (`xmlns:adlseq`, `xmlns:imsss`, `xmlns:adlnav`)
3. `xsi:schemaLocation` content
4. Presence of sequencing elements

**Common Issue**: Some packages have non-standard manifests. The detection is robust but may need enhancement for edge cases.

### API Discovery by SCORM Content

SCORM content searches for the API in this order:
1. `window.API` or `window.API_1484_11`
2. `window.parent.API` or `window.parent.API_1484_11`
3. Up through parent frames until found

**Critical**: The API must exist BEFORE iframe content loads.

### Offline Sync Flow

```
1. User action → SetValue/Commit
2. If offline:
   - Save to localStorage
   - Queue in offlineQueue[]
   - Store in sync_queue table
3. When online:
   - Auto-sync service processes queue
   - Sends to server via /api/sync/upload
   - Marks as synced in database
   - Retries on failure (max 3 times)
```

---

## Common Patterns

### Adding a New SCORM API Endpoint

1. Add route in `src/routes/scorm.routes.js`
2. Add controller method in `src/controllers/scorm.controller.js`
3. Add business logic in `src/services/scorm-api.js`
4. Add database statement in `src/models/database.js` if needed

### Adding a New Player

1. Create HTML file in `public/`
2. Load scorm-again from CDN
3. Initialize API before loading content:
   ```javascript
   window.API = new Scorm12API(settings);
   iframe.src = contentUrl;
   ```
4. Add link from `public/index.html`

### Debugging SCORM Issues

1. Check browser console for API errors
2. Use `public/diagnostic.html` for system check
3. Enable debug logging:
   ```javascript
   new Scorm2004API({ logLevel: 1 }) // DEBUG level
   ```
4. Check `window.API` or `window.API_1484_11` exists

---

## Database Schema Reference

### packages
```sql
id TEXT PRIMARY KEY
title TEXT
scorm_version TEXT       -- '1.2' or '2004'
launch_path TEXT         -- Relative path to entry point
metadata TEXT            -- Full manifest JSON
file_path TEXT           -- Absolute path to extracted package
uploaded_at INTEGER
```

### scorm_sessions
```sql
id TEXT PRIMARY KEY
package_id TEXT
user_id TEXT
completed INTEGER        -- 0 or 1
success_status TEXT      -- 'passed', 'failed', 'completed'
score_raw REAL
suspend_data TEXT        -- SCORM suspend data
session_time TEXT
```

### sync_queue
```sql
id INTEGER PRIMARY KEY
session_id TEXT
package_id TEXT
action TEXT              -- 'initialize', 'commit', 'terminate'
data TEXT                -- JSON action data
synced INTEGER           -- 0 = pending, 1 = synced
retry_count INTEGER
```

---

## Dependencies

### Core Backend
- `express` - Web framework
- `better-sqlite3` - SQLite database
- `adm-zip` - SCORM package extraction
- `xml2js` - Manifest XML parsing
- `multer` - File upload handling
- `uuid` - ID generation
- `cors` - CORS middleware

### Frontend (CDN)
- `scorm-again` - SCORM runtime (loaded from unpkg.com)

### Dev Dependencies
- `nodemon` - Auto-reload during development

---

## Testing & Debugging

### Manual Testing Flow
1. Upload package via `http://localhost:3000/upload.html`
2. Test with `http://localhost:3000/simple-player.html`
3. Check debug console for API calls
4. Test offline: DevTools → Network → Offline checkbox
5. Verify sync: Check `/api/sync/status`

### Diagnostic Tools
- `/diagnostic.html` - System health check
- `/direct-test.html` - API functionality test
- Browser DevTools console - All SCORM calls logged

---

## Known Issues & Workarounds

### Issue 1: "Unable to acquire LMS API"
**Cause**: API not initialized before content loads  
**Solution**: Use `simple-player.html` or `offline-player.html` which pre-initialize APIs

### Issue 2: SCORM 2004 Detection Fails
**Cause**: Non-standard manifest structure  
**Solution**: Enhanced detection in `scorm-parser.js` checks multiple indicators

### Issue 3: CDN Libraries Not Loading
**Cause**: Network issues or CDN down  
**Solution**: Players have fallback CDN (unpkg.com) and simple API stubs

### Issue 4: CORS Errors
**Cause**: Serving content from different origin  
**Solution**: CORS enabled in server.js, all content served from same origin

---

## Development Workflow

### Starting Development
```bash
npm install
npm run dev              # Auto-reload with nodemon
```

### Making Changes
1. Edit source files in `src/` or `public/`
2. Server auto-reloads (if using `npm run dev`)
3. Hard refresh browser (Cmd+Shift+R) to clear cache
4. Check console for errors

### Testing Changes
1. Upload test SCORM package
2. Use simple-player.html for quick tests
3. Use offline-player.html for offline testing
4. Check database: `sqlite3 storage/db/scorm.db`

---

## External Integrations

### Moodle Integration
Reference implementation based on Moodle SCORM player architecture. To integrate:
1. Deploy this backend separately
2. Create Moodle plugin that calls our REST API
3. Embed iframe with `/api-wrapper.html?packageId=X`
4. Sync data back to Moodle via `/api/sync/upload`

### Custom LMS Integration
Edit `src/services/offline-sync.js`:
```javascript
async syncCommit(sessionId, packageId, data) {
  // Replace with your LMS endpoint
  await fetch('https://your-lms.com/api/scorm/commit', {
    method: 'POST',
    body: JSON.stringify({ sessionId, packageId, data })
  });
}
```

---

## Performance Considerations

### File Size Limits
- Default: 500MB per package (configurable in `config.js`)
- SQLite handles packages up to ~2GB total
- For larger deployments, migrate to PostgreSQL

### Concurrent Users
- SQLite works well for <100 concurrent users
- For production scale, use PostgreSQL or MySQL
- Schema is portable (minimal SQLite-specific syntax)

### Caching Strategy
- Service Worker caches SCORM content
- API responses cached for offline use
- Static assets cached indefinitely

---

## Security Considerations

### Current Implementation
- Basic input validation
- File type restrictions (.zip only)
- Path traversal protection
- CORS configured for development

### Production TODO
- [ ] Add authentication (JWT recommended)
- [ ] Add authorization (user/admin roles)
- [ ] Validate uploaded packages (virus scan)
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Sanitize user inputs

---

## Deployment Notes

### Development
```bash
npm run dev
# Runs on http://localhost:3000
```

### Production
```bash
npm install --production
NODE_ENV=production npm start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - CORS configuration
- See `.env.example` for all options

---

## API Endpoint Reference

### Package Management
- `POST /api/packages/upload` - Upload SCORM .zip
- `GET /api/packages` - List all (sorted by uploaded_at DESC)
- `GET /api/packages/:id` - Get package details + manifest
- `DELETE /api/packages/:id` - Delete package (cascades sessions)
- `GET /api/packages/:id/launch` - Get launch URL + wrapped URL
- `GET /api/packages/:id/download` - Download offline bundle
- `GET /api/packages/:id/content/*` - Serve package files

### SCORM API
- `POST /api/scorm/:packageId/initialize` - Create session
- `POST /api/scorm/:packageId/commit` - Commit CMI data
- `POST /api/scorm/:packageId/terminate` - End session
- `GET /api/scorm/:packageId/get/:element` - Get CMI value
- `POST /api/scorm/:packageId/set/:element` - Set CMI value

### Sync & Monitoring
- `POST /api/sync/upload` - Upload offline session data
- `GET /api/sync/status` - Get sync queue status
- `POST /api/sync/trigger` - Manual sync
- `GET /health` - Server health check

---

## Important Files

### Configuration
- `src/config/config.js` - All settings, paths, limits
- `.env.example` - Environment variable template

### Core Services
- `src/services/scorm-parser.js` - **CRITICAL**: Parses imsmanifest.xml
- `src/services/package-handler.js` - **CRITICAL**: Extracts and manages packages
- `src/services/scorm-api.js` - **CRITICAL**: Session and CMI management
- `src/services/offline-sync.js` - Sync queue processor

### Database
- `src/models/database.js` - Schema, prepared statements, indexes

### Players
- `public/simple-player.html` - **RECOMMENDED**: Basic, reliable
- `public/offline-player.html` - **RECOMMENDED**: Full offline support
- `public/test-player.html` - Advanced debugging

---

## Coding Guidelines

### When Adding Features

1. **Follow the pattern**: Controller → Service → Database
2. **Use prepared statements**: Never concatenate SQL
3. **Handle errors**: Try-catch all async operations
4. **Log appropriately**: Use console.log for important events
5. **Update documentation**: Keep README.md in sync

### SCORM-Specific Guidelines

1. **API must be ready first**: Initialize before loading content
2. **Support both versions**: Always consider 1.2 and 2004
3. **Validate CMI data**: Use scorm-again's built-in validation
4. **Store all interactions**: Track everything for reporting
5. **Test offline**: Always test with DevTools offline mode

### Frontend Guidelines

1. **No frameworks**: Keep vanilla JavaScript for simplicity
2. **Load scorm-again from CDN**: Don't bundle it
3. **Create API immediately**: Even if placeholder
4. **Handle offline gracefully**: Show user-friendly messages
5. **Debug console**: Provide visibility into API calls

---

## Common Tasks

### Adding Support for New SCORM Element

1. No code changes needed! scorm-again handles all CMI elements
2. Data automatically stored in `cmi_data` table
3. Client can set/get any valid SCORM element

### Adding External LMS Integration

Edit `src/services/offline-sync.js`:
```javascript
async syncCommit(sessionId, packageId, data) {
  const response = await fetch(process.env.LMS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LMS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId, packageId, data })
  });
  
  if (!response.ok) {
    throw new Error('LMS sync failed');
  }
}
```

### Switching from SQLite to PostgreSQL

1. Replace `better-sqlite3` with `pg`
2. Update `src/models/database.js`:
   - Change connection code
   - Update SQL syntax (mostly compatible)
   - Replace prepared statements with parameterized queries
3. Update migrations for production

---

## Testing Checklist

### Before Committing

- [ ] Test SCORM 1.2 package upload
- [ ] Test SCORM 2004 package upload
- [ ] Test simple-player.html loads content
- [ ] Test offline mode (DevTools → Offline)
- [ ] Check no console errors
- [ ] Verify sync queue works
- [ ] Test with real SCORM content

### Integration Testing

- [ ] Upload various SCORM packages
- [ ] Test from different authoring tools (Articulate, Captivate, etc.)
- [ ] Test multi-SCO packages
- [ ] Test with sequencing (SCORM 2004)
- [ ] Test large packages (>100MB)

---

## Troubleshooting Guide

### Server Won't Start
- Check `storage/` directories exist
- Verify port 3000 is available
- Check `package.json` dependencies installed
- Look for syntax errors in recent changes

### Package Upload Fails
- Check file is valid .zip
- Verify imsmanifest.xml exists in package
- Check package size < 500MB (or configured limit)
- Examine server console for parsing errors

### Content Won't Load
- Verify API is initialized (check `window.API`)
- Check launch path is correct in manifest
- Use diagnostic.html to troubleshoot
- Check browser console for CORS errors

### Sync Not Working
- Check `/api/sync/status` for queue size
- Verify auto-sync is enabled (default: yes)
- Check network connectivity
- Examine `sync_queue` table in database

---

## Related Projects

### scorm-again Library
- **GitHub**: https://github.com/jcputney/scorm-again
- **Docs**: https://jcputney.github.io/scorm-again/
- **Purpose**: Our SCORM runtime implementation
- **Version**: 3.0+ (with offline support)

### Reference Implementations
- **Moodle SCORM Module**: Architecture inspiration
- **SCORM Cloud (Rustici)**: Commercial reference
- **ADL Specifications**: SCORM standards

---

## Future Enhancements

### Planned Features
- [ ] User authentication system
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] Video progress tracking
- [ ] xAPI/CMI5 support

### Performance Improvements
- [ ] Redis caching layer
- [ ] CDN integration for packages
- [ ] Database connection pooling
- [ ] Horizontal scaling support

### UX Enhancements
- [ ] Progress indicators
- [ ] Course completion certificates
- [ ] Bookmarking
- [ ] Mobile app (React Native)

---

## Questions to Ask When Making Changes

1. **Does it work offline?** - Test without network
2. **Does it handle both SCORM versions?** - Test 1.2 and 2004
3. **Is data persisted?** - Check database and localStorage
4. **Does it sync when online?** - Verify sync queue
5. **Is it documented?** - Update relevant .md files

---

## Contact & Support

- **Repository**: https://github.com/BlakeAcorn/Offline-SCORM-2
- **scorm-again**: https://github.com/jcputney/scorm-again
- **SCORM Spec**: https://adlnet.gov/projects/scorm/

---

## License

MIT License - See LICENSE file for details

---

**Last Updated**: February 2026  
**Project Version**: 1.0.0  
**SCORM Support**: 1.2, 2004 (3rd/4th Edition)
