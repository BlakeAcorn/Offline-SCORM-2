import express from 'express';
import multer from 'multer';
import path from 'path';
import config from '../config/config.js';
import packageController from '../controllers/package.controller.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.paths.uploads);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.scorm.maxPackageSize,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.scorm.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .zip files are allowed.'));
    }
  },
});

// Package routes
router.post('/upload', upload.single('package'), (req, res) => 
  packageController.uploadPackage(req, res)
);

router.get('/', (req, res) => 
  packageController.getAllPackages(req, res)
);

router.get('/:packageId', (req, res) => 
  packageController.getPackage(req, res)
);

router.delete('/:packageId', (req, res) => 
  packageController.deletePackage(req, res)
);

router.get('/:packageId/launch', (req, res) => 
  packageController.getLaunchUrl(req, res)
);

router.get('/:packageId/download', (req, res) => 
  packageController.downloadPackage(req, res)
);

// Serve package content (wildcard route - must be last)
router.get('/:packageId/content/*', (req, res) => 
  packageController.serveContent(req, res)
);

export default router;
