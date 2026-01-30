/**
 * MongoDB Atlas Data API Client
 *
 * This client handles all HTTP communication with the MongoDB Atlas Data API.
 *
 * MULTI-TENANT: This client receives credentials per-request via TenantCredentials,
 * allowing a single server to serve multiple tenants with different API keys.
 *
 * API Reference: https://www.mongodb.com/docs/atlas/app-services/data-api/
 *
 * Available Endpoints:
 * - findOne: Find a single document
 * - find: Find multiple documents
 * - insertOne: Insert a single document
 * - insertMany: Insert multiple documents
 * - updateOne: Update a single document
 * - updateMany: Update multiple documents
 * - deleteOne: Delete a single document
 * - deleteMany: Delete multiple documents
 * - aggregate: Run aggregation pipeline
 */

import type { TenantCredentials } from './types/env.js';
import { AuthenticationError, MongoDbApiError, RateLimitError } from './utils/errors.js';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default base URL for MongoDB Atlas Data API
 * Format: https://data.mongodb-api.com/app/{app_id}/endpoint/data/v1
 */
const DEFAULT_BASE_URL = 'https://data.mongodb-api.com/app';

// =============================================================================
// Types
// =============================================================================

/** MongoDB filter object */
export type MongoFilter = Record<string, unknown>;

/** MongoDB projection object */
export type MongoProjection = Record<string, 0 | 1 | boolean>;

/** MongoDB sort object */
export type MongoSort = Record<string, 1 | -1>;

/** MongoDB update object */
export type MongoUpdate = Record<string, unknown>;

/** MongoDB document */
export type MongoDocument = Record<string, unknown>;

/** Aggregation pipeline stage */
export type AggregationStage = Record<string, unknown>;

/** Find result */
export interface FindResult {
  documents: MongoDocument[];
}

/** Find one result */
export interface FindOneResult {
  document: MongoDocument | null;
}

/** Insert one result */
export interface InsertOneResult {
  insertedId: string;
}

/** Insert many result */
export interface InsertManyResult {
  insertedIds: string[];
}

/** Update result */
export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedId?: string;
}

/** Delete result */
export interface DeleteResult {
  deletedCount: number;
}

/** Aggregate result */
export interface AggregateResult {
  documents: MongoDocument[];
}

// =============================================================================
// MongoDB Client Interface
// =============================================================================

export interface MongoDbClient {
  // Connection
  testConnection(): Promise<{ connected: boolean; message: string }>;

  // Find operations
  findOne(
    database: string,
    collection: string,
    filter?: MongoFilter,
    projection?: MongoProjection
  ): Promise<FindOneResult>;

  find(
    database: string,
    collection: string,
    filter?: MongoFilter,
    projection?: MongoProjection,
    sort?: MongoSort,
    limit?: number,
    skip?: number
  ): Promise<FindResult>;

  // Insert operations
  insertOne(
    database: string,
    collection: string,
    document: MongoDocument
  ): Promise<InsertOneResult>;

  insertMany(
    database: string,
    collection: string,
    documents: MongoDocument[]
  ): Promise<InsertManyResult>;

  // Update operations
  updateOne(
    database: string,
    collection: string,
    filter: MongoFilter,
    update: MongoUpdate,
    upsert?: boolean
  ): Promise<UpdateResult>;

  updateMany(
    database: string,
    collection: string,
    filter: MongoFilter,
    update: MongoUpdate,
    upsert?: boolean
  ): Promise<UpdateResult>;

  // Delete operations
  deleteOne(database: string, collection: string, filter: MongoFilter): Promise<DeleteResult>;

  deleteMany(database: string, collection: string, filter: MongoFilter): Promise<DeleteResult>;

  // Aggregation
  aggregate(
    database: string,
    collection: string,
    pipeline: AggregationStage[]
  ): Promise<AggregateResult>;
}

// =============================================================================
// MongoDB Client Implementation
// =============================================================================

class MongoDbClientImpl implements MongoDbClient {
  private credentials: TenantCredentials;
  private baseUrl: string;

  constructor(credentials: TenantCredentials) {
    this.credentials = credentials;
    // Build base URL: https://data.mongodb-api.com/app/{app_id}/endpoint/data/v1
    if (credentials.baseUrl) {
      this.baseUrl = credentials.baseUrl;
    } else {
      this.baseUrl = `${DEFAULT_BASE_URL}/${credentials.appId}/endpoint/data/v1`;
    }
  }

  // ===========================================================================
  // HTTP Request Helper
  // ===========================================================================

  private getAuthHeaders(): Record<string, string> {
    if (!this.credentials.apiKey) {
      throw new AuthenticationError('No API key provided. Include X-MongoDB-API-Key header.');
    }

    return {
      'api-key': this.credentials.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(action: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/action/${action}`;

    // Add dataSource to all requests
    const requestBody = {
      dataSource: this.credentials.dataSource,
      ...body,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(requestBody),
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        'Rate limit exceeded',
        retryAfter ? Number.parseInt(retryAfter, 10) : 60
      );
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError('Authentication failed. Check your API key and App ID.');
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.text();
      let message = `MongoDB API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.error || errorJson.message || message;
      } catch {
        // Use default message
      }
      throw new MongoDbApiError(message, response.status);
    }

    return response.json() as Promise<T>;
  }

  // ===========================================================================
  // Connection Test
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Test by attempting a simple find operation
      await this.request<FindResult>('find', {
        database: 'admin',
        collection: 'system.version',
        filter: {},
        limit: 1,
      });
      return {
        connected: true,
        message: `Successfully connected to MongoDB Atlas (dataSource: ${this.credentials.dataSource})`,
      };
    } catch (_error) {
      // Even if the above fails (e.g., no access to admin), try a simple ping-like operation
      try {
        // Try to list a collection that might not exist - a 404 still means we're connected
        await this.request<FindResult>('find', {
          database: 'test',
          collection: '__connection_test__',
          filter: {},
          limit: 1,
        });
        return {
          connected: true,
          message: `Successfully connected to MongoDB Atlas (dataSource: ${this.credentials.dataSource})`,
        };
      } catch (secondError) {
        // If it's an auth error, connection works but credentials are wrong
        if (secondError instanceof AuthenticationError) {
          return {
            connected: false,
            message: 'Authentication failed. Check your API key and App ID.',
          };
        }
        // For empty response or collection not found, connection is still working
        if (secondError instanceof MongoDbApiError && secondError.statusCode !== 401) {
          return {
            connected: true,
            message: `Connected to MongoDB Atlas (dataSource: ${this.credentials.dataSource})`,
          };
        }
        return {
          connected: false,
          message: secondError instanceof Error ? secondError.message : 'Connection failed',
        };
      }
    }
  }

  // ===========================================================================
  // Find Operations
  // ===========================================================================

  async findOne(
    database: string,
    collection: string,
    filter: MongoFilter = {},
    projection?: MongoProjection
  ): Promise<FindOneResult> {
    const body: Record<string, unknown> = {
      database,
      collection,
      filter,
    };

    if (projection) {
      body.projection = projection;
    }

    return this.request<FindOneResult>('findOne', body);
  }

  async find(
    database: string,
    collection: string,
    filter: MongoFilter = {},
    projection?: MongoProjection,
    sort?: MongoSort,
    limit?: number,
    skip?: number
  ): Promise<FindResult> {
    const body: Record<string, unknown> = {
      database,
      collection,
      filter,
    };

    if (projection) {
      body.projection = projection;
    }
    if (sort) {
      body.sort = sort;
    }
    if (limit !== undefined) {
      body.limit = limit;
    }
    if (skip !== undefined) {
      body.skip = skip;
    }

    return this.request<FindResult>('find', body);
  }

  // ===========================================================================
  // Insert Operations
  // ===========================================================================

  async insertOne(
    database: string,
    collection: string,
    document: MongoDocument
  ): Promise<InsertOneResult> {
    return this.request<InsertOneResult>('insertOne', {
      database,
      collection,
      document,
    });
  }

  async insertMany(
    database: string,
    collection: string,
    documents: MongoDocument[]
  ): Promise<InsertManyResult> {
    return this.request<InsertManyResult>('insertMany', {
      database,
      collection,
      documents,
    });
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async updateOne(
    database: string,
    collection: string,
    filter: MongoFilter,
    update: MongoUpdate,
    upsert = false
  ): Promise<UpdateResult> {
    return this.request<UpdateResult>('updateOne', {
      database,
      collection,
      filter,
      update,
      upsert,
    });
  }

  async updateMany(
    database: string,
    collection: string,
    filter: MongoFilter,
    update: MongoUpdate,
    upsert = false
  ): Promise<UpdateResult> {
    return this.request<UpdateResult>('updateMany', {
      database,
      collection,
      filter,
      update,
      upsert,
    });
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  async deleteOne(
    database: string,
    collection: string,
    filter: MongoFilter
  ): Promise<DeleteResult> {
    return this.request<DeleteResult>('deleteOne', {
      database,
      collection,
      filter,
    });
  }

  async deleteMany(
    database: string,
    collection: string,
    filter: MongoFilter
  ): Promise<DeleteResult> {
    return this.request<DeleteResult>('deleteMany', {
      database,
      collection,
      filter,
    });
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  async aggregate(
    database: string,
    collection: string,
    pipeline: AggregationStage[]
  ): Promise<AggregateResult> {
    return this.request<AggregateResult>('aggregate', {
      database,
      collection,
      pipeline,
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a MongoDB client instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides its own credentials via headers,
 * allowing a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
export function createMongoDbClient(credentials: TenantCredentials): MongoDbClient {
  return new MongoDbClientImpl(credentials);
}
