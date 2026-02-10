import packageHandler from '../services/package-handler.js';

export class PackageController {
  /**
   * Upload and process SCORM package
   */
  async uploadPackage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Validate package
      const validation = await packageHandler.validatePackage(req.file.path);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      // Process package
      const result = await packageHandler.processPackage(
        req.file.path,
        req.file.originalname
      );

      res.json(result);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get all packages
   */
  async getAllPackages(req, res) {
    try {
      const packages = packageHandler.getAllPackages();
      
      res.json({
        success: true,
        packages,
        count: packages.length,
      });
    } catch (error) {
      console.error('Get packages error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get package by ID
   */
  async getPackage(req, res) {
    try {
      const { packageId } = req.params;
      const pkg = packageHandler.getPackage(packageId);

      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found',
        });
      }

      res.json({
        success: true,
        package: pkg,
      });
    } catch (error) {
      console.error('Get package error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Delete package
   */
  async deletePackage(req, res) {
    try {
      const { packageId } = req.params;
      await packageHandler.deletePackage(packageId);

      res.json({
        success: true,
        message: 'Package deleted successfully',
      });
    } catch (error) {
      console.error('Delete package error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get package launch URL
   */
  async getLaunchUrl(req, res) {
    try {
      const { packageId } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const pkg = packageHandler.getPackage(packageId);
      
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found',
        });
      }
      
      const manifestData = pkg.metadata;
      const launchPath = manifestData.launchData?.launchUrl || pkg.launch_path;
      
      if (!launchPath) {
        return res.status(404).json({
          success: false,
          error: 'No launch path found in package',
        });
      }
      
      // Return both direct and wrapped URLs
      const directUrl = `${baseUrl}/api/packages/${packageId}/content/${launchPath}`;
      const wrappedUrl = `${baseUrl}/api-wrapper.html?packageId=${packageId}`;

      res.json({
        success: true,
        launchUrl: directUrl,
        wrappedUrl: wrappedUrl,
        packageId,
        scormVersion: pkg.scorm_version,
      });
    } catch (error) {
      console.error('Get launch URL error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Serve package content files
   */
  async serveContent(req, res) {
    try {
      const { packageId } = req.params;
      const relativePath = req.params[0]; // Captures wildcard path

      const filePath = packageHandler.getPackageFilePath(packageId, relativePath);

      res.sendFile(filePath);
    } catch (error) {
      console.error('Serve content error:', error);
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Download package for offline use
   */
  async downloadPackage(req, res) {
    try {
      const { packageId } = req.params;
      const pkg = packageHandler.getPackage(packageId);

      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found',
        });
      }

      const bundle = await packageHandler.createOfflineBundle(packageId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${pkg.title}.zip"`);
      res.send(bundle);
    } catch (error) {
      console.error('Download package error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new PackageController();
