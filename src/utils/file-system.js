import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Recursively delete directory and contents
 */
export async function deleteDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const files = await readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await stat(filePath);
    
    if (stats.isDirectory()) {
      await deleteDir(filePath);
    } else {
      await unlink(filePath);
    }
  }
  
  await rmdir(dirPath);
}

/**
 * Get directory size recursively
 */
export async function getDirectorySize(dirPath) {
  let size = 0;
  
  const files = await readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await stat(filePath);
    
    if (stats.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      size += stats.size;
    }
  }
  
  return size;
}

/**
 * Find file recursively in directory
 */
export async function findFile(dirPath, filename) {
  const files = await readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await stat(filePath);
    
    if (stats.isDirectory()) {
      const found = await findFile(filePath, filename);
      if (found) return found;
    } else if (file.toLowerCase() === filename.toLowerCase()) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * Copy directory recursively
 */
export async function copyDir(src, dest) {
  await ensureDir(dest);
  const files = await readdir(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stats = await stat(srcPath);
    
    if (stats.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get file extension
 */
export function getExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}
