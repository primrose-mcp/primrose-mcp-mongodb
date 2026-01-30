/**
 * Aggregation Tools
 *
 * MCP tools for MongoDB aggregation pipeline operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MongoDbClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register aggregation-related tools
 */
export function registerAggregationTools(server: McpServer, client: MongoDbClient): void {
  // ===========================================================================
  // Aggregate
  // ===========================================================================
  server.tool(
    'mongodb_aggregate',
    `Run an aggregation pipeline on a MongoDB collection.

The aggregation pipeline is MongoDB's powerful data processing framework.
Each stage transforms the documents as they pass through the pipeline.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - pipeline: Aggregation pipeline as JSON array of stage objects (required)

Common pipeline stages:
  - $match: Filter documents (like find)
  - $group: Group documents and compute aggregates
  - $sort: Sort documents
  - $limit: Limit number of documents
  - $skip: Skip documents
  - $project: Reshape documents (include/exclude/compute fields)
  - $unwind: Deconstruct array fields
  - $lookup: Join with another collection
  - $count: Count documents
  - $addFields: Add computed fields

Example pipeline (count by status):
[
  { "$match": { "active": true } },
  { "$group": { "_id": "$status", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
]

Example pipeline (join with lookup):
[
  { "$match": { "orderId": "123" } },
  { "$lookup": {
      "from": "customers",
      "localField": "customerId",
      "foreignField": "_id",
      "as": "customer"
  }},
  { "$unwind": "$customer" }
]`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      pipeline: z.string().describe('Aggregation pipeline as JSON array string'),
    },
    async ({ database, collection, pipeline }) => {
      try {
        const pipelineArray = JSON.parse(pipeline);
        if (!Array.isArray(pipelineArray)) {
          throw new Error('Pipeline must be an array of stage objects');
        }
        const result = await client.aggregate(database, collection, pipelineArray);
        return formatResponse({
          documents: result.documents,
          count: result.documents.length,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Count Documents (convenience wrapper around aggregate)
  // ===========================================================================
  server.tool(
    'mongodb_count',
    `Count documents in a MongoDB collection matching a filter.

This is a convenience wrapper around the aggregation pipeline.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - filter: Query filter as JSON object (optional, defaults to {} for all documents)

Returns:
  The count of matching documents.

Example filter: { "status": "active", "type": "premium" }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      filter: z.string().optional().describe('Query filter as JSON string'),
    },
    async ({ database, collection, filter }) => {
      try {
        const filterObj = filter ? JSON.parse(filter) : {};

        // Build a count pipeline
        const pipeline = [{ $match: filterObj }, { $count: 'count' }];

        const result = await client.aggregate(database, collection, pipeline);

        const count = result.documents.length > 0 ? result.documents[0].count : 0;

        return formatResponse({
          count,
          filter: filterObj,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Distinct Values (convenience wrapper around aggregate)
  // ===========================================================================
  server.tool(
    'mongodb_distinct',
    `Get distinct values for a field in a MongoDB collection.

This is a convenience wrapper around the aggregation pipeline.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - field: Field name to get distinct values for (required)
  - filter: Query filter as JSON object (optional)

Returns:
  Array of distinct values for the specified field.

Example: Get all unique statuses: field="status"`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      field: z.string().describe('Field name to get distinct values for'),
      filter: z.string().optional().describe('Query filter as JSON string'),
    },
    async ({ database, collection, field, filter }) => {
      try {
        const filterObj = filter ? JSON.parse(filter) : {};

        // Build a distinct pipeline
        const pipeline = [
          { $match: filterObj },
          { $group: { _id: `$${field}` } },
          { $sort: { _id: 1 } },
        ];

        const result = await client.aggregate(database, collection, pipeline);

        const values = result.documents.map((doc) => doc._id).filter((v) => v !== null);

        return formatResponse({
          field,
          values,
          count: values.length,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Group By (convenience wrapper around aggregate)
  // ===========================================================================
  server.tool(
    'mongodb_group_by',
    `Group documents by a field and compute aggregates.

This is a convenience wrapper around the $group aggregation stage.

Args:
  - database: Database name (required)
  - collection: Collection name (required)
  - groupBy: Field name to group by (required)
  - filter: Query filter as JSON object (optional)
  - aggregations: JSON object with aggregation operations (optional)
    - count: true to include count
    - sum: field name to sum
    - avg: field name to average
    - min: field name to get minimum
    - max: field name to get maximum

Returns:
  Grouped results with computed aggregates.

Example: Group orders by status with total amount
  groupBy: "status"
  aggregations: { "count": true, "sum": "amount" }`,
    {
      database: z.string().describe('Database name'),
      collection: z.string().describe('Collection name'),
      groupBy: z.string().describe('Field name to group by'),
      filter: z.string().optional().describe('Query filter as JSON string'),
      aggregations: z.string().optional().describe('Aggregation operations as JSON object'),
    },
    async ({ database, collection, groupBy, filter, aggregations }) => {
      try {
        const filterObj = filter ? JSON.parse(filter) : {};
        const aggObj = aggregations ? JSON.parse(aggregations) : { count: true };

        // Build the $group stage
        const groupStage: Record<string, unknown> = {
          _id: `$${groupBy}`,
        };

        if (aggObj.count) {
          groupStage.count = { $sum: 1 };
        }
        if (aggObj.sum) {
          groupStage.total = { $sum: `$${aggObj.sum}` };
        }
        if (aggObj.avg) {
          groupStage.average = { $avg: `$${aggObj.avg}` };
        }
        if (aggObj.min) {
          groupStage.min = { $min: `$${aggObj.min}` };
        }
        if (aggObj.max) {
          groupStage.max = { $max: `$${aggObj.max}` };
        }

        const pipeline = [
          { $match: filterObj },
          { $group: groupStage },
          { $sort: { count: -1, _id: 1 } },
        ];

        const result = await client.aggregate(database, collection, pipeline);

        // Rename _id to the groupBy field name for clarity
        const formattedResults = result.documents.map((doc) => ({
          [groupBy]: doc._id,
          ...Object.fromEntries(Object.entries(doc).filter(([key]) => key !== '_id')),
        }));

        return formatResponse({
          groupedBy: groupBy,
          results: formattedResults,
          count: formattedResults.length,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
