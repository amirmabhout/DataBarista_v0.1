import fs from 'fs';
import path from 'path';
import { elizaLogger } from '@elizaos/core';

/**
 * Get a random match identifier image path from the assets directory
 * @returns Path to a randomly selected match image
 */
export function getRandomMatchImage(): string {
  try {
    // Define the directory where match images are stored
    const assetsDir = path.join(__dirname, '../assets');
    elizaLogger.info(`[getRandomMatchImage] Looking for match images in directory: ${assetsDir}`);
    
    // Check if directory exists
    if (!fs.existsSync(assetsDir)) {
      elizaLogger.error(`[getRandomMatchImage] Assets directory does not exist: ${assetsDir}`);
      return '';
    }
    
    // Get all image files that match the pattern
    const allFiles = fs.readdirSync(assetsDir);
    elizaLogger.info(`[getRandomMatchImage] Found ${allFiles.length} total files in assets directory`);
    
    const matchImageFiles = allFiles
      .filter(file => file.startsWith('imagematch-') && file.endsWith('.jpg'));
    
    elizaLogger.info(`[getRandomMatchImage] Found ${matchImageFiles.length} match image files`);
    
    if (matchImageFiles.length === 0) {
      elizaLogger.error('[getRandomMatchImage] No match images found in assets directory');
      
      // Log all files in the directory for debugging
      if (allFiles.length > 0) {
        elizaLogger.debug(`[getRandomMatchImage] Files in directory: ${allFiles.join(', ')}`);
      }
      
      return '';
    }
    
    // Select a random image file
    const randomIndex = Math.floor(Math.random() * matchImageFiles.length);
    const selectedImage = matchImageFiles[randomIndex];
    
    const fullImagePath = path.join(assetsDir, selectedImage);
    elizaLogger.info(`[getRandomMatchImage] Selected random match image: ${selectedImage}`);
    elizaLogger.info(`[getRandomMatchImage] Full path: ${fullImagePath}`);
    
    // Verify the image exists at the path
    if (!fs.existsSync(fullImagePath)) {
      elizaLogger.error(`[getRandomMatchImage] Selected image does not exist at path: ${fullImagePath}`);
      return '';
    }
    
    // Return the full path to the selected image
    return fullImagePath;
  } catch (error) {
    elizaLogger.error('[getRandomMatchImage] Error selecting random match image:', error);
    return '';
  }
} 