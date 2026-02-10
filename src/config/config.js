import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  
  // Storage paths
  paths: {
    root: path.join(__dirname, '../..'),
    storage: path.join(__dirname, '../../storage'),
    packages: path.join(__dirname, '../../storage/packages'),
    uploads: path.join(__dirname, '../../storage/uploads'),
    database: path.join(__dirname, '../../storage/db'),
  },
  
  // Database configuration
  database: {
    filename: 'scorm.db',
  },
  
  // SCORM configuration
  scorm: {
    supportedVersions: ['1.2', '2004'],
    maxPackageSize: 500 * 1024 * 1024, // 500MB
    allowedExtensions: ['.zip'],
  },
  
  // Offline sync configuration
  sync: {
    batchSize: 100,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
};

export default config;
