/**
 * Shared types and interfaces used across DataBarista actions
 */

/**
 * Interface for SPARQL query objects
 */
export interface SparqlQuery {
  query: string;
}

/**
 * Interface for DKG client configuration
 */
export interface DkgClientConfig {
  environment: string;
  endpoint: string;
  port: string | number;
  blockchain: {
    name: string;
    publicKey: string;
    privateKey: string;
  };
  maxNumberOfRetries?: number;
  frequency?: number;
  contentType?: string;
  nodeApiVersion?: string;
}

/**
 * Interface for user profile data
 */
export interface UserProfile {
  knowledgeDomain: string;
  projectDomain: string;
  desiredConnections: string;
  intent?: string;
  challenge?: string;
  projDesc?: string;
}

/**
 * Interface for match candidate data
 */
export interface MatchCandidate {
  username: string;
  name?: string;
  knowledgeDomain?: string;
  background?: string;
  desiredConnections?: string;
  projectType?: string;
  projectDomain?: string;
  challenge?: string;
  projectName?: string;
  projectDescription?: string;
}

/**
 * Interface for knowledge graph extraction result
 */
export interface KgExtractionResult {
  analysis: {
    matchType: 'exact_match' | 'update_existing' | 'new_information';
    existingIntentionId?: string;
    existingProjectId?: string;
    reason: string;
  };
  public: {
    '@context': {
      schema: string;
      datalatte: string;
    };
    '@type': string;
    '@id': string;
    [key: string]: any;
  };
  private: {
    '@context': {
      schema: string;
      datalatte: string;
      foaf: string;
    };
    '@type': string;
    '@id': string;
    [key: string]: any;
  };
} 