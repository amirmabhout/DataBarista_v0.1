/**
 * Utility functions for handling profile data
 */

/**
 * Strips embedding data from profile objects to reduce context size when passing to LLMs
 * @param profileData Profile data that may contain embeddings
 * @returns A clean copy of the profile data without embedding vectors
 */
export function stripEmbeddings(profileData: any): any {
  // Handle null/undefined case
  if (!profileData) return profileData;
  
  // If it's an array, process each item
  if (Array.isArray(profileData)) {
    return profileData.map(item => stripEmbeddings(item));
  }
  
  // If it's an object, create a new object without the embedding field
  if (typeof profileData === 'object') {
    const result = { ...profileData };
    
    // Remove embedding field if present
    if ('embedding' in result) {
      delete result.embedding;
    }
    
    // Process nested objects that might contain profile data with embeddings
    if (result.latestProfile) {
      result.latestProfile = stripEmbeddings(result.latestProfile);
    }
    
    if (result.profileVersions && Array.isArray(result.profileVersions)) {
      result.profileVersions = result.profileVersions.map(version => stripEmbeddings(version));
    }
    
    // Process public/private fields that might contain profile data
    if (result.public) {
      result.public = stripEmbeddings(result.public);
    }
    
    if (result.private) {
      result.private = stripEmbeddings(result.private);
    }
    
    // Process profileData field if present
    if (result.profileData) {
      result.profileData = stripEmbeddings(result.profileData);
    }
    
    return result;
  }
  
  // For primitive values, return as is
  return profileData;
} 