# MongoDB Atlas MCP Server

[![Primrose MCP](https://img.shields.io/badge/Primrose-MCP-blue)](https://primrose.dev/mcp/mongodb)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for the MongoDB Atlas Data API. This server enables AI assistants to interact with MongoDB Atlas databases, performing document operations and aggregations.

## Features

- **Aggregation** - Run powerful aggregation pipelines
- **Documents** - Full CRUD operations on documents

## Quick Start

The easiest way to get started is using the [Primrose SDK](https://github.com/primrose-ai/primrose-mcp):

```bash
npm install primrose-mcp
```

```typescript
import { createMCPClient } from 'primrose-mcp';

const client = createMCPClient('mongodb', {
  headers: {
    'X-MongoDB-API-Key': 'your-mongodb-api-key',
    'X-MongoDB-App-ID': 'your-app-id',
    'X-MongoDB-Data-Source': 'Cluster0'
  }
});
```

## Manual Installation

Clone and install dependencies:

```bash
git clone https://github.com/primrose-ai/primrose-mcp-mongodb.git
cd primrose-mcp-mongodb
npm install
```

## Configuration

### Required Headers

| Header | Description |
|--------|-------------|
| `X-MongoDB-API-Key` | MongoDB Atlas Data API key |
| `X-MongoDB-App-ID` | Your MongoDB Atlas App ID |
| `X-MongoDB-Data-Source` | Cluster name (e.g., "Cluster0") |

### Optional Headers

| Header | Description |
|--------|-------------|
| `X-MongoDB-Base-URL` | Override the default Data API base URL |

### Setting Up Atlas Data API

1. Log into [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to App Services
3. Create a new application or select existing
4. Enable the Data API
5. Create an API key with appropriate permissions

## Available Tools

### Document Tools
- `mongodb_find_one` - Find a single document
- `mongodb_find` - Find multiple documents with query
- `mongodb_insert_one` - Insert a single document
- `mongodb_insert_many` - Insert multiple documents
- `mongodb_update_one` - Update a single document
- `mongodb_update_many` - Update multiple documents
- `mongodb_delete_one` - Delete a single document
- `mongodb_delete_many` - Delete multiple documents
- `mongodb_replace_one` - Replace a document

### Aggregation Tools
- `mongodb_aggregate` - Run an aggregation pipeline

## Usage Examples

### Finding Documents

```typescript
// Find documents with a filter
const result = await client.callTool('mongodb_find', {
  database: 'mydb',
  collection: 'users',
  filter: { status: 'active' },
  limit: 10
});
```

### Inserting Documents

```typescript
// Insert a new document
const result = await client.callTool('mongodb_insert_one', {
  database: 'mydb',
  collection: 'users',
  document: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active'
  }
});
```

### Running Aggregations

```typescript
// Run an aggregation pipeline
const result = await client.callTool('mongodb_aggregate', {
  database: 'mydb',
  collection: 'orders',
  pipeline: [
    { $match: { status: 'completed' } },
    { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } }
  ]
});
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Related Resources

- [Primrose SDK](https://github.com/primrose-ai/primrose-mcp) - Unified SDK for all Primrose MCP servers
- [MongoDB Atlas Data API](https://www.mongodb.com/docs/atlas/api/data-api/)
- [MongoDB Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
