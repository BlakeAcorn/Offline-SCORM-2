import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import { promisify } from 'util';
import config from '../config/config.js';
import scormParser from './scorm-parser.js';
import { statements } from '../models/database.js';
import { ensureDir, deleteDir, getDirectorySize } from '../utils/file-system.js';

const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

/**
 * Handle SCORM package operations
 */
export class PackageHandler {
  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize storage directories
   */
  async initializeStorage() {
    await ensureDir(config.paths.packages);
    await ensureDir(config.paths.uploads);
  }

  /**
   * Process uploaded SCORM package
   */
  async processPackage(filePath, filename) {
    const packageId = uuidv4();
    const packageDir = path.join(config.paths.packages, packageId);

    try {
      // Extract package
      await this.extractPackage(filePath, packageDir);

      // Parse manifest
      const manifestData = await scormParser.parseManifest(packageDir);

      // Get package size
      const size = await getDirectorySize(packageDir);

      // Store in database
      const packageData = {
        id: packageId,
        title: manifestData.title,
        version: manifestData.metadata.schemaVersion,
        scormVersion: manifestData.version,
        identifier: manifestData.identifier,
        launchPath: manifestData.launchData?.launchUrl || '',
        metadata: JSON.stringify(manifestData),
        filePath: packageDir,
        fileSize: size,
      };

      statements.insertPackage.run(
        packageData.id,
        packageData.title,
        packageData.version,
        packageData.scormVersion,
        packageData.identifier,
        packageData.launchPath,
        packageData.metadata,
        packageData.filePath,
        packageData.fileSize
      );

      // Clean up uploaded file
      await unlink(filePath);

      return {
        success: true,
        packageId,
        data: packageData,
        manifestData,
      };
    } catch (error) {
      // Clean up on error
      await deleteDir(packageDir);
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
      
      throw error;
    }
  }

  /**
   * Extract ZIP package
   */
  async extractPackage(zipPath, extractPath) {
    try {
      await ensureDir(extractPath);
      
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      // Verify extraction
      if (!fs.existsSync(extractPath)) {
        throw new Error('Package extraction failed');
      }
    } catch (error) {
      throw new Error(`Failed to extract package: ${error.message}`);
    }
  }

  /**
   * Get package by ID
   */
  getPackage(packageId) {
    const pkg = statements.getPackage.get(packageId);
    
    if (!pkg) {
      return null;
    }

    return {
      ...pkg,
      metadata: JSON.parse(pkg.metadata),
    };
  }

  /**
   * Get all packages
   */
  getAllPackages() {
    const packages = statements.getAllPackages.all();
    
    return packages.map(pkg => ({
      ...pkg,
      metadata: JSON.parse(pkg.metadata),
    }));
  }

  /**
   * Delete package
   */
  async deletePackage(packageId) {
    const pkg = this.getPackage(packageId);
    
    if (!pkg) {
      throw new Error('Package not found');
    }

    // Delete from database (cascades to sessions)
    statements.deletePackage.run(packageId);

    // Delete files
    await deleteDir(pkg.file_path);

    return { success: true };
  }

  /**
   * Get package launch URL
   */
  getPackageLaunchUrl(packageId, baseUrl) {
    const pkg = this.getPackage(packageId);
    
    if (!pkg) {
      throw new Error('Package not found');
    }

    const manifestData = pkg.metadata;
    const launchPath = manifestData.launchData?.launchUrl || pkg.launch_path;

    if (!launchPath) {
      throw new Error('No launch path found in package');
    }

    return `${baseUrl}/api/packages/${packageId}/content/${launchPath}`;
  }

  /**
   * Get package file path
   */
  getPackageFilePath(packageId, relativePath) {
    const pkg = this.getPackage(packageId);
    
    if (!pkg) {
      throw new Error('Package not found');
    }

    const fullPath = path.join(pkg.file_path, relativePath);

    // Security check: ensure path is within package directory
    if (!fullPath.startsWith(pkg.file_path)) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    return fullPath;
  }

  /**
   * Create package bundle for offline use
   */
  async createOfflineBundle(packageId) {
    const pkg = this.getPackage(packageId);
    
    if (!pkg) {
      throw new Error('Package not found');
    }

    // Create ZIP of package with offline player
    const zip = new AdmZip();
    
    // Add package files
    zip.addLocalFolder(pkg.file_path);

    // Add offline player HTML wrapper
    const offlinePlayer = this.generateOfflinePlayer(pkg);
    zip.addFile('offline-player.html', Buffer.from(offlinePlayer, 'utf-8'));

    // Add offline configuration
    const offlineConfig = {
      packageId: pkg.id,
      title: pkg.title,
      version: pkg.scorm_version,
      launchPath: pkg.launch_path,
      enableOfflineSupport: true,
      syncOnInitialize: true,
      syncOnTerminate: true,
    };
    zip.addFile('offline-config.json', Buffer.from(JSON.stringify(offlineConfig, null, 2), 'utf-8'));

    return zip.toBuffer();
  }

  /**
   * Generate offline player HTML
   */
  generateOfflinePlayer(pkg) {
    const scormVersion = pkg.scorm_version.startsWith('2004') ? '2004' : '1.2';
    const apiName = scormVersion === '2004' ? 'API_1484_11' : 'API';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pkg.title} - Offline Player</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        #scorm-content {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe id="scorm-content" src="${pkg.launch_path}"></iframe>
    
    <!-- Include scorm-again library from CDN -->
    <script src="https://cdn.jsdelivr.net/npm/scorm-again@latest/dist/scorm${scormVersion === '1.2' ? '12' : '2004'}.min.js"></script>
    
    <script>
        // Load offline configuration
        fetch('./offline-config.json')
            .then(response => response.json())
            .then(config => {
                // Initialize SCORM API with offline support
                const settings = {
                    autocommit: true,
                    autocommitSeconds: 10,
                    enableOfflineSupport: true,
                    courseId: config.packageId,
                    syncOnInitialize: true,
                    syncOnTerminate: true,
                    logLevel: 'INFO',
                };

                // Create API
                window.${apiName} = new ${scormVersion === '1.2' ? 'Scorm12API' : 'Scorm2004API'}(settings);

                // Listen for SCORM events
                window.${apiName}.on('${scormVersion === '1.2' ? 'LMS' : ''}Initialize', () => {
                    console.log('SCORM session initialized');
                });

                window.${apiName}.on('${scormVersion === '1.2' ? 'LMS' : ''}Commit', () => {
                    console.log('SCORM data committed (offline)');
                });

                window.${apiName}.on('${scormVersion === '1.2' ? 'LMS' : ''}Finish', () => {
                    console.log('SCORM session finished');
                });

                console.log('Offline SCORM player initialized for: ' + config.title);
            })
            .catch(error => {
                console.error('Failed to load offline configuration:', error);
            });
    </script>
</body>
</html>`;
  }

  /**
   * Validate package before upload
   */
  async validatePackage(filePath) {
    try {
      // Check file size
      const stats = await stat(filePath);
      if (stats.size > config.scorm.maxPackageSize) {
        throw new Error(`Package exceeds maximum size of ${config.scorm.maxPackageSize} bytes`);
      }

      // Check if valid ZIP
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();

      if (entries.length === 0) {
        throw new Error('Package is empty');
      }

      // Check for manifest
      const hasManifest = entries.some(entry => 
        entry.entryName.toLowerCase().endsWith('imsmanifest.xml')
      );

      if (!hasManifest) {
        throw new Error('Package does not contain imsmanifest.xml');
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

export default new PackageHandler();
