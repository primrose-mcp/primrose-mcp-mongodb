/**
 * MongoDB Atlas Data API MCP Server - Main Entry Point
 *
 * This file sets up the MCP server using Cloudflare's Agents SDK.
 * It provides a stateless HTTP endpoint for MongoDB operations.
 *
 * MULTI-TENANT ARCHITECTURE:
 * Tenant credentials (API keys, App IDs, etc.) are parsed from request headers,
 * allowing a single server deployment to serve multiple customers.
 *
 * Required Headers:
 * - X-MongoDB-API-Key: MongoDB Atlas Data API key
 * - X-MongoDB-App-ID: MongoDB Atlas App ID
 * - X-MongoDB-Data-Source: Cluster name (e.g., "Cluster0")
 *
 * Optional Headers:
 * - X-MongoDB-Base-URL: Override the default Data API base URL
 *
 * Available Tools:
 * - mongodb_find_one: Find a single document
 * - mongodb_find: Find multiple documents
 * - mongodb_insert_one: Insert a single document
 * - mongodb_insert_many: Insert multiple documents
 * - mongodb_update_one: Update a single document
 * - mongodb_update_many: Update multiple documents
 * - mongodb_delete_one: Delete a single document
 * - mongodb_delete_many: Delete multiple documents
 * - mongodb_aggregate: Run aggregation pipeline
 * - mongodb_count: Count documents
 * - mongodb_distinct: Get distinct values
 * - mongodb_group_by: Group and aggregate
 * - mongodb_test_connection: Test API connection
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { createMongoDbClient } from './client.js';
import { registerAggregationTools, registerDocumentTools } from './tools/index.js';
import {
  type Env,
  parseTenantCredentials,
  type TenantCredentials,
  validateCredentials,
} from './types/env.js';

// =============================================================================
// MCP Server Configuration
// =============================================================================

const SERVER_NAME = 'primrose-mcp-mongodb';
const SERVER_VERSION = '1.0.0';

// =============================================================================
// MCP Agent (Stateful - uses Durable Objects)
// =============================================================================

/**
 * McpAgent provides stateful MCP sessions backed by Durable Objects.
 *
 * NOTE: For multi-tenant deployments, use the stateless mode instead.
 * The stateful McpAgent is better suited for single-tenant deployments.
 *
 * @deprecated For multi-tenant support, use stateless mode with per-request credentials
 */
export class MongoDbMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  async init() {
    throw new Error(
      'Stateful mode (McpAgent) is not supported for multi-tenant deployments. ' +
        'Use the stateless /mcp endpoint with X-MongoDB-API-Key header instead.'
    );
  }
}

// =============================================================================
// Stateless MCP Server (Recommended - no Durable Objects needed)
// =============================================================================

/**
 * Creates a stateless MCP server instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides credentials via headers, allowing
 * a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
function createStatelessServer(credentials: TenantCredentials): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Create client with tenant-specific credentials
  const client = createMongoDbClient(credentials);

  // Register all tools
  registerDocumentTools(server, client);
  registerAggregationTools(server, client);

  // Test connection tool
  server.tool(
    'mongodb_test_connection',
    'Test the connection to the MongoDB Atlas Data API',
    {},
    async () => {
      try {
        const result = await client.testConnection();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// =============================================================================
// Worker Export
// =============================================================================

export default {
  /**
   * Main fetch handler for the Worker
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', server: SERVER_NAME }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ==========================================================================
    // Stateless MCP with Streamable HTTP (Recommended for multi-tenant)
    // ==========================================================================
    if (url.pathname === '/mcp' && request.method === 'POST') {
      // Parse tenant credentials from request headers
      const credentials = parseTenantCredentials(request);

      // Validate credentials are present
      try {
        validateCredentials(credentials);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid credentials',
            required_headers: ['X-MongoDB-API-Key', 'X-MongoDB-App-ID', 'X-MongoDB-Data-Source'],
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Create server with tenant-specific credentials
      const server = createStatelessServer(credentials);

      // Import and use createMcpHandler for streamable HTTP
      const { createMcpHandler } = await import('agents/mcp');
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    // SSE endpoint for legacy clients
    if (url.pathname === '/sse') {
      return new Response('SSE endpoint requires Durable Objects. Enable in wrangler.jsonc.', {
        status: 501,
      });
    }

    // Default response - API documentation
    return new Response(
      JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: 'MongoDB Atlas Data API MCP Server',
        endpoints: {
          mcp: '/mcp (POST) - Streamable HTTP MCP endpoint',
          health: '/health - Health check',
        },
        authentication: {
          description: 'Pass tenant credentials via request headers',
          required_headers: {
            'X-MongoDB-API-Key': 'Your MongoDB Atlas Data API key',
            'X-MongoDB-App-ID': 'Your MongoDB Atlas App ID',
            'X-MongoDB-Data-Source': 'Cluster name (e.g., "Cluster0")',
          },
          optional_headers: {
            'X-MongoDB-Base-URL': 'Override the default Data API base URL',
          },
        },
        tools: [
          'mongodb_test_connection - Test API connection',
          'mongodb_find_one - Find a single document',
          'mongodb_find - Find multiple documents',
          'mongodb_insert_one - Insert a single document',
          'mongodb_insert_many - Insert multiple documents',
          'mongodb_update_one - Update a single document',
          'mongodb_update_many - Update multiple documents',
          'mongodb_delete_one - Delete a single document',
          'mongodb_delete_many - Delete multiple documents',
          'mongodb_aggregate - Run aggregation pipeline',
          'mongodb_count - Count documents',
          'mongodb_distinct - Get distinct values',
          'mongodb_group_by - Group and aggregate',
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
