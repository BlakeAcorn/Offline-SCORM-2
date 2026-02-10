# Offline SCORM Player - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites

- Node.js 16+ installed
- A SCORM package (.zip file) to test with

### Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages including the [scorm-again](https://github.com/jcputney/scorm-again) library.

### Step 2: Start the Server

```bash
# Development mode with auto-reload
npm run dev

# OR production mode
npm start
```

The server will start at `http://localhost:3000`

### Step 3: Upload a SCORM Package

**Option A: Using cURL**

```bash
curl -X POST http://localhost:3000/api/packages/upload \
  -F "package=@your-course.zip"
```

**Option B: Using Postman or Similar**

- POST to `http://localhost:3000/api/packages/upload`
- Body type: `form-data`
- Key: `package` (type: file)
- Value: Select your SCORM .zip file

You'll get a response with the `packageId`:

```json
{
  "success": true,
  "packageId": "abc123...",
  "data": {
    "title": "Your Course Title",
    "scormVersion": "2004"
  }
}
```

### Step 4: Play Your Course

Open in browser:
```
http://localhost:3000/player.html?packageId=YOUR_PACKAGE_ID
```

Replace `YOUR_PACKAGE_ID` with the ID from step 3.

## 📱 Testing Offline Functionality

### 1. Download Package for Offline Use

```bash
curl -O http://localhost:3000/api/packages/YOUR_PACKAGE_ID/download
```

This creates a standalone ZIP with:
- Complete SCORM package
- Offline player HTML
- Configuration file

### 2. Test in Browser DevTools

1. Open your course in Chrome
2. Open DevTools (F12)
3. Go to Network tab
4. Check "Offline" checkbox
5. Interact with the course
6. Uncheck "Offline" - data syncs automatically!

### 3. Install as PWA

1. Open `http://localhost:3000`
2. Look for install prompt (or use browser menu)
3. Click "Install"
4. Use like a native app with offline support!

## 🔧 Quick Configuration

### Change Port

Edit `package.json` or set environment variable:

```bash
PORT=8080 npm start
```

### Enable CORS for Specific Domain

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:
```
CORS_ORIGIN=https://yourdomain.com
```

## 📊 Monitor Activity

### View All Packages

```bash
curl http://localhost:3000/api/packages
```

### Check Sync Status

```bash
curl http://localhost:3000/api/sync/status
```

### View Session Data

```bash
curl http://localhost:3000/api/scorm/session/SESSION_ID
```

## 🎯 Integration Examples

### Embed in Your Web App

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/scorm-again@latest/dist/scorm2004.min.js"></script>
</head>
<body>
    <iframe id="scorm-content"></iframe>
    
    <script>
        // Initialize SCORM API
        window.API_1484_11 = new Scorm2004API({
            autocommit: true,
            lmsCommitUrl: 'http://localhost:3000/api/scorm/PACKAGE_ID/commit',
        });
        
        // Load course
        document.getElementById('scorm-content').src = 
            'http://localhost:3000/api/packages/PACKAGE_ID/content/index.html';
    </script>
</body>
</html>
```

### Use with React

```javascript
import { useEffect } from 'react';
import { Scorm2004API } from 'scorm-again';

function ScormPlayer({ packageId, userId }) {
    useEffect(() => {
        const api = new Scorm2004API({
            autocommit: true,
            lmsCommitUrl: `${API_URL}/scorm/${packageId}/commit`,
        });
        
        window.API_1484_11 = api;
        
        // Initialize session
        fetch(`${API_URL}/scorm/${packageId}/initialize`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
        
        return () => {
            api.terminate();
        };
    }, [packageId, userId]);
    
    return (
        <iframe src={`${API_URL}/packages/${packageId}/content/index.html`} />
    );
}
```

## 🐛 Troubleshooting

### "API not found" Error

**Problem**: SCORM content can't find the API

**Solution**: Check the API is attached to window:
```javascript
console.log(window.API);          // For SCORM 1.2
console.log(window.API_1484_11);  // For SCORM 2004
```

### Package Upload Fails

**Problem**: "Package exceeds maximum size"

**Solution**: Increase limit in `src/config/config.js`:
```javascript
maxPackageSize: 1024 * 1024 * 1024, // 1GB
```

### CORS Error

**Problem**: "Access blocked by CORS policy"

**Solution**: Update CORS config in `.env`:
```
CORS_ORIGIN=*
```

Or for specific domain:
```
CORS_ORIGIN=https://yourdomain.com
```

### Database Locked Error

**Problem**: "Database is locked"

**Solution**: SQLite doesn't handle concurrent writes well. For production, consider:
- PostgreSQL
- MySQL
- MongoDB

The database schema is in `src/models/database.js` - easy to migrate!

## 📚 Next Steps

1. **Read the Integration Guide**: See `INTEGRATION.md` for detailed integration info
2. **Explore the API**: Visit `http://localhost:3000/api` for endpoint documentation
3. **Check out scorm-again docs**: [https://jcputney.github.io/scorm-again/](https://jcputney.github.io/scorm-again/)
4. **Deploy to Production**: Use PM2, Docker, or your preferred deployment method

## 🎓 Example SCORM Packages

Need test packages? Try these:

- **SCORM.com Free Samples**: [https://scorm.com/scorm-explained/scorm-resources/scorm-12-sample-course/](https://scorm.com/scorm-explained/scorm-resources/scorm-12-sample-course/)
- **Rustici SCORM Cloud**: Sample courses available after free signup
- **Moodle**: Export any Moodle SCORM activity

## 💡 Tips

### Tip 1: Use Auto-commit

Enable auto-commit to reduce data loss:
```javascript
new Scorm2004API({
    autocommit: true,
    autocommitSeconds: 10,  // Commit every 10 seconds
});
```

### Tip 2: Track Everything

Listen to SCORM events:
```javascript
api.on('SetValue.*', (element, value) => {
    console.log(`Changed: ${element} = ${value}`);
    // Send to analytics, etc.
});
```

### Tip 3: Handle Offline Gracefully

Show users when they're offline:
```javascript
window.addEventListener('offline', () => {
    showNotification('Working offline - data will sync later');
});
```

### Tip 4: Test with Real Users

- Test on mobile devices
- Test with slow connections
- Test offline mode thoroughly
- Test with different SCORM versions

## 🤝 Need Help?

- **Issues**: Check existing GitHub issues or create a new one
- **scorm-again docs**: [https://jcputney.github.io/scorm-again/](https://jcputney.github.io/scorm-again/)
- **SCORM Spec**: [https://adlnet.gov/projects/scorm/](https://adlnet.gov/projects/scorm/)

## 📄 License

MIT License - See LICENSE file
