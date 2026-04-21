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
    "List all databases on the MySQL server of an organization",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT SCHEMA_NAME AS name,
                  DEFAULT_CHARACTER_SET_NAME AS charset,
                  DEFAULT_COLLATION_NAME AS collation
           FROM INFORMATION_SCHEMA.SCHEMATA
           WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'sys')
           ORDER BY SCHEMA_NAME`,
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
    "List all tables and views in a database",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const db = database || poolManager.getOrgConfig(org).database;
        const safeDb = db.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT TABLE_NAME AS table_name,
                  TABLE_TYPE AS table_type,
                  ENGINE AS engine,
                  TABLE_ROWS AS estimated_rows
           FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = '${safeDb}'
           ORDER BY TABLE_TYPE, TABLE_NAME`,
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
    },
    async ({ org, database, table }) => {
      try {
        const db = database || poolManager.getOrgConfig(org).database;
        const safeDb = db.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT COLUMN_NAME AS column_name,
                  COLUMN_TYPE AS column_type,
                  DATA_TYPE AS data_type,
                  CHARACTER_MAXIMUM_LENGTH AS max_length,
                  NUMERIC_PRECISION AS numeric_precision,
                  NUMERIC_SCALE AS numeric_scale,
                  IS_NULLABLE AS is_nullable,
                  COLUMN_DEFAULT AS column_default,
                  COLUMN_KEY AS column_key,
                  EXTRA AS extra,
                  ORDINAL_POSITION AS ordinal_position
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = '${safeDb}' AND TABLE_NAME = '${safeTable}'
           ORDER BY ORDINAL_POSITION`,
          database
        );
        return textResult({ database: db, table, columns: result.rows });
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
    },
    async ({ org, database, table }) => {
      try {
        const db = database || poolManager.getOrgConfig(org).database;
        const safeDb = db.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT CONSTRAINT_NAME AS constraint_name,
                  COLUMN_NAME AS column_name,
                  REFERENCED_TABLE_SCHEMA AS foreign_database,
                  REFERENCED_TABLE_NAME AS foreign_table,
                  REFERENCED_COLUMN_NAME AS foreign_column
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = '${safeDb}'
             AND TABLE_NAME = '${safeTable}'
             AND REFERENCED_TABLE_NAME IS NOT NULL
           ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
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
    },
    async ({ org, database, table }) => {
      try {
        const db = database || poolManager.getOrgConfig(org).database;
        const safeDb = db.replace(/'/g, "''");
        const safeTable = table.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT INDEX_NAME AS index_name,
                  NON_UNIQUE AS non_unique,
                  COLUMN_NAME AS column_name,
                  SEQ_IN_INDEX AS seq_in_index,
                  INDEX_TYPE AS index_type,
                  NULLABLE AS nullable
           FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = '${safeDb}' AND TABLE_NAME = '${safeTable}'
           ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
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
    "Get row counts and size estimates for all tables in a database",
    { org: orgKeySchema, database: databaseSchema },
    async ({ org, database }) => {
      try {
        const db = database || poolManager.getOrgConfig(org).database;
        const safeDb = db.replace(/'/g, "''");
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT TABLE_NAME AS table_name,
                  TABLE_ROWS AS estimated_row_count,
                  CONCAT(ROUND(DATA_LENGTH / 1024 / 1024, 2), ' MB') AS data_size,
                  CONCAT(ROUND(INDEX_LENGTH / 1024 / 1024, 2), ' MB') AS index_size,
                  CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') AS total_size,
                  ENGINE AS engine
           FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = '${safeDb}' AND TABLE_TYPE = 'BASE TABLE'
           ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`,
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
      limit: z.number().min(1).max(100).default(10).describe("Number of rows to return (max 100, default 10)"),
    },
    async ({ org, database, table, limit }) => {
      try {
        const safeTable = table.replace(/`/g, "``");
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        const result = await poolManager.executeReadOnly(
          org,
          `SELECT * FROM \`${safeTable}\` LIMIT ${safeLimit}`,
          database
        );
        return textResult({
          database: database || poolManager.getOrgConfig(org).database,
          table,
          row_count: result.rows.length,
          rows: result.rows,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "execute_query",
    `Execute a read-only SQL query (SELECT/WITH/EXPLAIN/SHOW/DESCRIBE only). Max ${maxRows} rows returned. The query runs inside a READ ONLY transaction for safety.`,
    {
      org: orgKeySchema,
      database: databaseSchema,
      query: z.string().describe("SQL query to execute (SELECT, WITH, EXPLAIN, SHOW, or DESCRIBE only)"),
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
          row_count: result.rows.length,
          fields: result.fields.map((f) => ({ name: f.name, type: f.type })),
          rows: result.rows,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );
}
