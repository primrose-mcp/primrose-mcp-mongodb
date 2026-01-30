/**
 * Response Formatting Utilities
 *
 * Helpers for formatting MongoDB tool responses.
 */

import { formatErrorForLogging, MongoDbApiError } from './errors.js';

/**
 * MCP tool response type
 * Note: Index signature required for MCP SDK 1.25+ compatibility
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Format a successful response
 */
export function formatResponse(data: unknown): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error response
 */
export function formatError(error: unknown): ToolResponse {
  const errorInfo = formatErrorForLogging(error);

  let message: string;
  if (error instanceof MongoDbApiError) {
    message = `Error: ${error.message}`;
    if (error.retryable) {
      message += ' (retryable)';
    }
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error: ${String(error)}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message, details: errorInfo }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Format documents for display
 */
export function formatDocuments(documents: unknown[]): ToolResponse {
  return formatResponse({
    documents,
    count: documents.length,
  });
}

/**
 * Format a single document for display
 */
export function formatDocument(document: unknown): ToolResponse {
  return formatResponse({ document });
}

/**
 * Format operation result (insert, update, delete)
 */
export function formatOperationResult(result: {
  insertedId?: string;
  insertedIds?: string[];
  matchedCount?: number;
  modifiedCount?: number;
  deletedCount?: number;
  upsertedId?: string;
}): ToolResponse {
  return formatResponse({
    success: true,
    ...result,
  });
}

/**
 * Format aggregation result
 */
export function formatAggregationResult(documents: unknown[]): ToolResponse {
  return formatResponse({
    documents,
    count: documents.length,
  });
}
