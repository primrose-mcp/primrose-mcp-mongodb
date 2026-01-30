/**
 * Document Tools
 *
 * MCP tools for MongoDB document operations (CRUD).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MongoDbClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all document-related tools
 */
export function registerDocumentTools(server: McpServer, client: MongoDbClient): void {
  // ===========================================================================
  // Find One
  // ===========================================================================
  server.tool(
    'mongodb_find_one',
    `Find a single document in a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter as JSON object (optional, defaults to {})
  - projection: Fields to include/exclude as JSON object (optional)

Returns:
  The first document matching the filter, or null if not found.

Example filter: { "status": "active", "age": { "$gte": 18 } }
Example projection: { "name": 1, "email": 1, "_id": 0 }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().optional().describe('Query filter as JSON string'),
      projection: z.string().optional().describe('Projection as JSON string'),
    },
    async ({ database, collection, filter, projection }) => {
      try {
        const filterObj = filter ? JSON.parse(filter) : {};
        const projectionObj = projection ? JSON.parse(projection) : undefined;

        const result = await client.findOne(database, collection, filterObj, projectionObj);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Find
  // ===========================================================================
  server.tool(
    'mongodb_find',
    `Find documents in a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter as JSON object (optional, defaults to {})
  - projection: Fields to include/exclude as JSON object (optional)
  - sort: Sort order as JSON object (optional, e.g., { "createdAt": -1 })
  - limit: Maximum number of documents to return (optional, default: 20)
  - skip: Number of documents to skip (optional)

Returns:
  Array of documents matching the filter.

Example filter: { "status": "active" }
Example sort: { "createdAt": -1, "name": 1 }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().optional().describe('Query filter as JSON string'),
      projection: z.string().optional().describe('Projection as JSON string'),
      sort: z.string().optional().describe('Sort order as JSON string'),
      limit: z.number().int().min(1).max(1000).default(20).describe('Maximum documents to return'),
      skip: z.number().int().min(0).optional().describe('Documents to skip'),
    },
    async ({ database, collection, filter, projection, sort, limit, skip }) => {
      try {
        const filterObj = filter ? JSON.parse(filter) : {};
        const projectionObj = projection ? JSON.parse(projection) : undefined;
        const sortObj = sort ? JSON.parse(sort) : undefined;

        const result = await client.find(
          database,
          collection,
          filterObj,
          projectionObj,
          sortObj,
          limit,
          skip
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Insert One
  // ===========================================================================
  server.tool(
    'mongodb_insert_one',
    `Insert a single document into a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - document: Document to insert as JSON object (required)

Returns:
  The inserted document ID.

Example document: { "name": "John", "email": "john@example.com", "age": 30 }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      document: z.string().describe('Document to insert as JSON string'),
    },
    async ({ database, collection, document }) => {
      try {
        const docObj = JSON.parse(document);
        const result = await client.insertOne(database, collection, docObj);
        return formatResponse({
          success: true,
          message: 'Document inserted successfully',
          insertedId: result.insertedId,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Insert Many
  // ===========================================================================
  server.tool(
    'mongodb_insert_many',
    `Insert multiple documents into a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - documents: Array of documents to insert as JSON array (required)

Returns:
  Array of inserted document IDs.

Example documents: [{ "name": "John" }, { "name": "Jane" }]`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      documents: z.string().describe('Documents to insert as JSON array string'),
    },
    async ({ database, collection, documents }) => {
      try {
        const docsArray = JSON.parse(documents);
        if (!Array.isArray(docsArray)) {
          throw new Error('Documents must be an array');
        }
        const result = await client.insertMany(database, collection, docsArray);
        return formatResponse({
          success: true,
          message: `${result.insertedIds.length} documents inserted successfully`,
          insertedIds: result.insertedIds,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update One
  // ===========================================================================
  server.tool(
    'mongodb_update_one',
    `Update a single document in a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter to find the document (required)
  - update: Update operations (required, use $set, $unset, etc.)
  - upsert: Create document if not found (optional, default: false)

Returns:
  Update result with matchedCount and modifiedCount.

Example filter: { "_id": "123" }
Example update: { "$set": { "status": "active" }, "$inc": { "views": 1 } }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().describe('Query filter as JSON string'),
      update: z.string().describe('Update operations as JSON string'),
      upsert: z.boolean().default(false).describe('Create if not found'),
    },
    async ({ database, collection, filter, update, upsert }) => {
      try {
        const filterObj = JSON.parse(filter);
        const updateObj = JSON.parse(update);
        const result = await client.updateOne(database, collection, filterObj, updateObj, upsert);
        return formatResponse({
          success: true,
          message:
            result.modifiedCount > 0
              ? 'Document updated successfully'
              : result.upsertedId
                ? 'Document upserted successfully'
                : 'No documents modified',
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Many
  // ===========================================================================
  server.tool(
    'mongodb_update_many',
    `Update multiple documents in a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter to find documents (required)
  - update: Update operations (required, use $set, $unset, etc.)
  - upsert: Create document if not found (optional, default: false)

Returns:
  Update result with matchedCount and modifiedCount.

Example filter: { "status": "pending" }
Example update: { "$set": { "status": "processed", "processedAt": "2024-01-01" } }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().describe('Query filter as JSON string'),
      update: z.string().describe('Update operations as JSON string'),
      upsert: z.boolean().default(false).describe('Create if not found'),
    },
    async ({ database, collection, filter, update, upsert }) => {
      try {
        const filterObj = JSON.parse(filter);
        const updateObj = JSON.parse(update);
        const result = await client.updateMany(database, collection, filterObj, updateObj, upsert);
        return formatResponse({
          success: true,
          message: `${result.modifiedCount} documents updated`,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete One
  // ===========================================================================
  server.tool(
    'mongodb_delete_one',
    `Delete a single document from a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter to find the document (required)

Returns:
  Delete result with deletedCount.

Example filter: { "_id": "123" }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().describe('Query filter as JSON string'),
    },
    async ({ database, collection, filter }) => {
      try {
        const filterObj = JSON.parse(filter);
        const result = await client.deleteOne(database, collection, filterObj);
        return formatResponse({
          success: true,
          message:
            result.deletedCount > 0
              ? 'Document deleted successfully'
              : 'No document found to delete',
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Many
  // ===========================================================================
  server.tool(
    'mongodb_delete_many',
    `Delete multiple documents from a MongoDB collection.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter to find documents (required)

Returns:
  Delete result with deletedCount.

Example filter: { "status": "archived", "createdAt": { "$lt": "2023-01-01" } }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().describe('Query filter as JSON string'),
    },
    async ({ database, collection, filter }) => {
      try {
        const filterObj = JSON.parse(filter);
        const result = await client.deleteMany(database, collection, filterObj);
        return formatResponse({
          success: true,
          message: `${result.deletedCount} documents deleted`,
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
