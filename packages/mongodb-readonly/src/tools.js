import { z } from "zod";
import { validateAggregationPipeline, parseJsonSafe } from "./query-validator.js";

function textResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerTools(server, clientManager, maxDocs) {
  const orgKeySchema = z
    .string()
    .describe("Organization identifier (use list_organizations to see available ones)");
  const databaseSchema = z
    .string()
    .optional()
    .describe("Database name (optional, use list_databases to see available ones). If omitted, uses the org default.");

  server.tool(
    "list_organizations",
    "List all configured organizations with their default database and connection status",
    {},
    async () => {
      const orgs = clientManager.getOrganizations();
      const results = await Promise.all(
        orgs.map(async (org) => {
          const status = await clientManager.testConnection(org.key);
          return { ...org, ...status };
        })
      );
      return textResult(results);
    }
  );

  server.tool(
    "list_databases",
    "List all databases on the MongoDB server of an organization",
    { org: orgKeySchema },
    async ({ org }) => {
      try {
        const client = await clientManager.getClient(org);
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();
        const databases = result.databases.map((db) => ({
          name: db.name,
          sizeOnDisk: db.sizeOnDisk,
          empty: db.empty,
        }));
        return textResult(databases);
      } catch (error) {
        if (error.codeName === "Unauthorized" || error.code === 13) {
          try {
            const config = clientManager.getOrgConfig(org);
            return textResult([
              { name: config.database, sizeOnDisk: null, empty: null, note: "listDatabases not authorized, showing configured default only" },
            ]);
          } catch (innerError) {
            return errorResult(innerError.message);
          }
        }
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "list_collections",
    "List all collections in a database with their types",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const db = await clientManager.getDatabase(org, database);
        const collections = await db.listCollections().toArray();
        const result = collections.map((col) => ({
          name: col.name,
          type: col.type,
          options: col.options,
        }));
        return textResult(result);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "describe_collection",
    "Infer the schema of a collection by sampling documents and listing indexes",
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      sample_size: z.number().min(1).max(100).default(20).describe("Number of documents to sample for schema inference (default 20)"),
    },
    async ({ org, database, collection, sample_size }) => {
      try {
        const db = await clientManager.getDatabase(org, database);
        const col = db.collection(collection);
        const docs = await col.find({}).limit(sample_size).toArray();
        const fieldMap = new Map();
        for (const doc of docs) {
          collectFields(doc, "", fieldMap);
        }
        const fields = [...fieldMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([path, types]) => ({
            path,
            types: [...types],
            frequency: `seen in sampled docs`,
          }));
        const indexes = await col.indexes();
        return textResult({
          collection,
          document_count: docs.length,
          inferred_fields: fields,
          indexes,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_indexes",
    "Get all indexes for a collection",
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
    },
    async ({ org, database, collection }) => {
      try {
        const db = await clientManager.getDatabase(org, database);
        const indexes = await db.collection(collection).indexes();
        return textResult(indexes);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_collection_stats",
    "Get statistics for collections in a database (document counts, sizes)",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const db = await clientManager.getDatabase(org, database);
        const collections = await db.listCollections().toArray();
        const stats = await Promise.all(
          collections.map(async (col) => {
            try {
              const result = await db.command({ collStats: col.name });
              return {
                collection: col.name,
                document_count: result.count,
                size: result.size,
                avg_document_size: result.avgObjSize,
                storage_size: result.storageSize,
                index_count: result.nindexes,
                total_index_size: result.totalIndexSize,
              };
            } catch {
              return {
                collection: col.name,
                error: "Unable to retrieve stats",
              };
            }
          })
        );
        return textResult(stats);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_sample_data",
    "Get sample documents from a collection",
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      limit: z.number().min(1).max(100).default(10).describe("Number of documents to return (max 100, default 10)"),
    },
    async ({ org, database, collection, limit }) => {
      try {
        const db = await clientManager.getDatabase(org, database);
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        const docs = await db.collection(collection).find({}).limit(safeLimit).toArray();
        return textResult({
          collection,
          document_count: docs.length,
          documents: docs,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "find_documents",
    `Execute a read-only find query on a collection. Returns up to ${maxDocs} documents. Pass filter and projection as JSON strings.`,
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      filter: z.string().default("{}").describe('MongoDB filter as JSON string (e.g. {"status": "active", "age": {"$gt": 18}})'),
      projection: z.string().optional().describe('Fields to include/exclude as JSON string (e.g. {"name": 1, "email": 1, "_id": 0})'),
      sort: z.string().optional().describe('Sort specification as JSON string (e.g. {"created_at": -1})'),
      limit: z.number().min(1).max(10000).optional().describe(`Max documents to return (default: ${maxDocs})`),
    },
    async ({ org, database, collection, filter, projection, sort, limit }) => {
      try {
        const parsedFilter = parseJsonSafe(filter, "filter");
        if (parsedFilter.error) return errorResult(parsedFilter.error);
        const options = {};
        if (projection) {
          const parsedProjection = parseJsonSafe(projection, "projection");
          if (parsedProjection.error) return errorResult(parsedProjection.error);
          options.projection = parsedProjection.value;
        }
        if (sort) {
          const parsedSort = parseJsonSafe(sort, "sort");
          if (parsedSort.error) return errorResult(parsedSort.error);
          options.sort = parsedSort.value;
        }
        const docLimit = Math.min(limit || maxDocs, maxDocs);
        options.limit = docLimit;
        const db = await clientManager.getDatabase(org, database);
        const docs = await db.collection(collection).find(parsedFilter.value, options).toArray();
        return textResult({
          collection,
          document_count: docs.length,
          documents: docs,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "aggregate",
    `Execute a read-only aggregation pipeline on a collection. Stages $out and $merge are blocked. Returns up to ${maxDocs} documents.`,
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      pipeline: z.string().describe('Aggregation pipeline as JSON array string (e.g. [{"$match": {"status": "active"}}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}])'),
    },
    async ({ org, database, collection, pipeline }) => {
      try {
        const parsedPipeline = parseJsonSafe(pipeline, "pipeline");
        if (parsedPipeline.error) return errorResult(parsedPipeline.error);
        const validation = validateAggregationPipeline(parsedPipeline.value);
        if (!validation.valid) return errorResult(validation.reason);
        const hasLimit = parsedPipeline.value.some((stage) => "$limit" in stage);
        const safePipeline = hasLimit
          ? parsedPipeline.value
          : [...parsedPipeline.value, { $limit: maxDocs }];
        const db = await clientManager.getDatabase(org, database);
        const docs = await db.collection(collection).aggregate(safePipeline).toArray();
        return textResult({
          collection,
          document_count: docs.length,
          documents: docs,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "count_documents",
    "Count documents in a collection matching a filter",
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      filter: z.string().default("{}").describe('MongoDB filter as JSON string (e.g. {"status": "active"})'),
    },
    async ({ org, database, collection, filter }) => {
      try {
        const parsedFilter = parseJsonSafe(filter, "filter");
        if (parsedFilter.error) return errorResult(parsedFilter.error);
        const db = await clientManager.getDatabase(org, database);
        const count = await db.collection(collection).countDocuments(parsedFilter.value);
        return textResult({ collection, filter: parsedFilter.value, count });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "distinct_values",
    "Get distinct values for a field in a collection, optionally filtered",
    {
      org: orgKeySchema,
      database: databaseSchema,
      collection: z.string().describe("Collection name"),
      field: z.string().describe("Field name to get distinct values for"),
      filter: z.string().default("{}").describe('MongoDB filter as JSON string (optional)'),
    },
    async ({ org, database, collection, field, filter }) => {
      try {
        const parsedFilter = parseJsonSafe(filter, "filter");
        if (parsedFilter.error) return errorResult(parsedFilter.error);
        const db = await clientManager.getDatabase(org, database);
        const values = await db.collection(collection).distinct(field, parsedFilter.value);
        return textResult({
          collection,
          field,
          count: values.length,
          values: values.length > maxDocs ? values.slice(0, maxDocs) : values,
          truncated: values.length > maxDocs,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );
}

function collectFields(obj, prefix, fieldMap) {
  if (obj === null || obj === undefined) return;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = getMongoType(value);
    if (!fieldMap.has(path)) {
      fieldMap.set(path, new Set());
    }
    fieldMap.get(path).add(type);
    if (type === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      collectFields(value, path, fieldMap);
    }
  }
}

function getMongoType(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (typeof value === "object" && value._bsontype === "ObjectId") return "ObjectId";
  if (typeof value === "object" && value._bsontype === "Decimal128") return "Decimal128";
  if (typeof value === "object" && value._bsontype === "Binary") return "Binary";
  if (typeof value === "object" && value._bsontype) return value._bsontype;
  return typeof value;
}
