import { z } from "zod";
import { validateReadOnlyQuery } from "./query-validator.js";

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

export function registerTools(server, poolManager, maxRows) {
  const orgKeySchema = z
    .string()
    .describe("Organization identifier (use list_organizations to see available ones)");
  const databaseSchema = z
    .string()
    .optional()
    .describe("Database name (optional, use list_databases to see available ones). If omitted, uses the org default.");
  const schemaSchema = z
    .string()
    .default("public")
    .describe("Schema name (default: public)");

  server.tool(
    "list_organizations",
    "List all configured organizations with their default database and connection status",
    {},
    async () => {
      const orgs = poolManager.getOrganizations();
      const results = await Promise.all(
        orgs.map(async (org) => {
          const status = await poolManager.testConnection(org.key);
          return { ...org, ...status };
        })
      );
      return textResult(results);
    }
  );

  server.tool(
    "list_databases",
    "List all databases on the PostgreSQL server of an organization",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT datname AS name, pg_catalog.pg_encoding_to_char(encoding) AS encoding,
                  datcollate AS collation, datconnlimit AS connection_limit
           FROM pg_catalog.pg_database
           WHERE datistemplate = false
           ORDER BY datname`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "list_schemas",
    "List all user schemas in a database with their table counts",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT schema_name,
                  (SELECT count(*) FROM information_schema.tables t WHERE t.table_schema = s.schema_name) AS table_count
           FROM information_schema.schemata s
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
             AND schema_name NOT LIKE 'pg_temp_%'
             AND schema_name NOT LIKE 'pg_toast_temp_%'
           ORDER BY schema_name`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "list_tables",
    "List all tables and views in a specific schema",
    { org: orgKeySchema, database: databaseSchema, schema: schemaSchema },
    async ({ org, database, schema }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT table_name, table_type
           FROM information_schema.tables
           WHERE table_schema = '${safeSchema}'
           ORDER BY table_type, table_name`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "describe_table",
    "Get detailed column information for a table including types, nullability, defaults, and primary keys",
    {
      org: orgKeySchema,
      database: databaseSchema,
      table: z.string().describe("Table name"),
      schema: schemaSchema,
    },
    async ({ org, database, table, schema }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const columnsResult = await poolManager.executeReadOnly(
          org,
          `SELECT column_name, data_type, character_maximum_length,
                  numeric_precision, numeric_scale,
                  is_nullable, column_default, ordinal_position
           FROM information_schema.columns
           WHERE table_schema = '${safeSchema}' AND table_name = '${safeTable}'
           ORDER BY ordinal_position`,
          database
        );
        const pkResult = await poolManager.executeReadOnly(
          org,
          `SELECT kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = '${safeSchema}'
             AND tc.table_name = '${safeTable}'`,
          database
        );
        const pkColumns = pkResult.rows.map((r) => r.column_name);
        const columns = columnsResult.rows.map((col) => ({
          ...col,
          is_primary_key: pkColumns.includes(col.column_name),
        }));
        return textResult({ schema, table, columns });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_foreign_keys",
    "Get foreign key relationships for a table",
    {
      org: orgKeySchema,
      database: databaseSchema,
      table: z.string().describe("Table name"),
      schema: schemaSchema,
    },
    async ({ org, database, table, schema }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT tc.constraint_name,
                  kcu.column_name,
                  ccu.table_schema AS foreign_schema,
                  ccu.table_name AS foreign_table,
                  ccu.column_name AS foreign_column
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = '${safeSchema}'
             AND tc.table_name = '${safeTable}'
           ORDER BY tc.constraint_name`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_indexes",
    "Get indexes for a table",
    {
      org: orgKeySchema,
      database: databaseSchema,
      table: z.string().describe("Table name"),
      schema: schemaSchema,
    },
    async ({ org, database, table, schema }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT indexname, indexdef
           FROM pg_indexes
           WHERE schemaname = '${safeSchema}' AND tablename = '${safeTable}'
           ORDER BY indexname`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_table_stats",
    "Get row counts and size estimates for all tables in a schema",
    { org: orgKeySchema, database: databaseSchema, schema: schemaSchema },
    async ({ org, database, schema }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT relname AS table_name,
                  n_live_tup AS estimated_row_count,
                  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
                  pg_size_pretty(pg_relation_size(c.oid)) AS data_size,
                  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
           FROM pg_stat_user_tables s
           JOIN pg_class c ON c.relname = s.relname AND c.relnamespace = (
             SELECT oid FROM pg_namespace WHERE nspname = '${safeSchema}'
           )
           WHERE s.schemaname = '${safeSchema}'
           ORDER BY pg_total_relation_size(c.oid) DESC`,
          database
        );
        return textResult(result.rows);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_sample_data",
    "Get sample rows from a table (limited preview)",
    {
      org: orgKeySchema,
      database: databaseSchema,
      table: z.string().describe("Table name"),
      schema: schemaSchema,
      limit: z.number().min(1).max(100).default(10).describe("Number of rows to return (max 100, default 10)"),
    },
    async ({ org, database, table, schema, limit }) => {
      try {
        const safeSchema = schema.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT * FROM "${safeSchema}"."${safeTable}" LIMIT ${safeLimit}`,
          database
        );
        return textResult({
          schema,
          table,
          row_count: result.rowCount,
          rows: result.rows,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "execute_query",
    `Execute a read-only SQL query (SELECT/WITH/EXPLAIN/SHOW only). Max ${maxRows} rows returned. The query runs inside a READ ONLY transaction for safety.`,
    {
      org: orgKeySchema,
      database: databaseSchema,
      query: z.string().describe("SQL query to execute (SELECT, WITH, EXPLAIN, or SHOW only)"),
    },
    async ({ org, database, query }) => {
      const validation = validateReadOnlyQuery(query);
      if (!validation.valid) {
        return errorResult(validation.reason);
      }
      try {
        const hasLimit = /\bLIMIT\s+\d+/i.test(query);
        const finalQuery = hasLimit ? query : `${query} LIMIT ${maxRows}`;
        const result = await poolManager.executeReadOnly(org, finalQuery, database);
        return textResult({
          row_count: result.rowCount,
          fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          rows: result.rows,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );
}
