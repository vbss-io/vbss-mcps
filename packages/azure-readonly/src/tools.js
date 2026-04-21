import { z } from "zod";

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

function truncatedResult(data, maxChars = 100000) {
  const output = JSON.stringify(data, null, 2);
  if (output.length <= maxChars) {
    return { content: [{ type: "text", text: output }] };
  }
  return {
    content: [{
      type: "text",
      text: output.slice(0, maxChars) + `\n\n... TRUNCATED (${output.length} chars). Narrow your query.`,
    }],
  };
}

async function collectPages(pageable, maxItems = 5000) {
  const items = [];
  for await (const item of pageable) {
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}

async function withRetry(fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isTooMany = error.statusCode === 429 || (error.message && error.message.includes("Too many requests"));
      if (!isTooMany || attempt === retries) throw error;
      const delay = (attempt + 1) * 5000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function buildCostQuery({ timeframe, startDate, endDate, granularity, groupBy, filterDimension, filterValues }) {
  const dataset = {
    granularity: granularity || "None",
    aggregation: {
      totalCost: { name: "PreTaxCost", function: "Sum" },
    },
  };
  if (groupBy) {
    const groups = Array.isArray(groupBy) ? groupBy : [groupBy];
    dataset.grouping = groups.map((name) => ({ name, type: "Dimension" }));
  }
  if (filterDimension && filterValues) {
    dataset.filter = {
      dimensions: {
        name: filterDimension,
        operator: "In",
        values: Array.isArray(filterValues) ? filterValues : [filterValues],
      },
    };
  }
  const queryDef = { type: "Usage", timeframe: timeframe || "MonthToDate", dataset };
  if ((timeframe === "Custom") && startDate && endDate) {
    queryDef.timePeriod = { from: new Date(startDate), to: new Date(endDate) };
  }
  return queryDef;
}

function parseCostResult(result) {
  const columns = (result.columns || []).map((c) => c.name);
  const rows = (result.rows || []).map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  return { columns, rows };
}

export function registerTools(server, clientManager) {
  const orgSchema = z
    .string()
    .describe("Organization identifier (use list_organizations to see available ones)");

  // ─── Organizations ───

  server.tool(
    "list_organizations",
    "List all configured Azure organizations with connection status",
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

  // ─── Subscriptions ───

  server.tool(
    "list_subscriptions",
    "List all Azure subscriptions accessible by the org's service principal",
    { org: orgSchema },
    async ({ org }) => {
      try {
        const { subscriptions } = clientManager.getClients(org);
        const items = await collectPages(subscriptions.subscriptions.list());
        const result = items.map((s) => ({
          id: s.subscriptionId,
          name: s.displayName,
          state: s.state,
          tenantId: s.tenantId,
        }));
        return textResult(result);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── Resource Inventory (Resource Graph) ───

  server.tool(
    "query_resources",
    "Run an Azure Resource Graph KQL query for resource inventory. IMPORTANT: Always use '| project' to select only the fields you need. Examples: 'Resources | where type == \"microsoft.compute/virtualmachines\" | project name, location, resourceGroup' or 'Resources | summarize count() by type | order by count_ desc'",
    {
      org: orgSchema,
      query: z.string().describe("KQL query for Azure Resource Graph. Always use '| project' to select specific fields."),
    },
    async ({ org, query }) => {
      try {
        const clients = clientManager.getClients(org);
        const result = await clients.resourceGraph.resources({
          subscriptions: [clients.subscriptionId],
          query,
          options: { top: 100 },
        });
        return truncatedResult({
          total_records: result.totalRecords,
          count: result.count,
          data: result.data,
        });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── Resource Details ───

  server.tool(
    "get_resource",
    "Get details for a specific Azure resource by its full resource ID",
    {
      org: orgSchema,
      resourceId: z
        .string()
        .describe("Full Azure resource ID (e.g., /subscriptions/.../resourceGroups/.../providers/...)"),
      apiVersion: z
        .string()
        .default("2024-03-01")
        .describe("API version for the resource provider (default: 2024-03-01)"),
    },
    async ({ org, resourceId, apiVersion }) => {
      try {
        const { resources } = clientManager.getClients(org);
        const result = await resources.resources.getById(resourceId, apiVersion);
        return truncatedResult(result);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── List Resource Groups ───

  server.tool(
    "list_resource_groups",
    "List all resource groups in the subscription with their locations and tags",
    { org: orgSchema },
    async ({ org }) => {
      try {
        const { resources } = clientManager.getClients(org);
        const items = await collectPages(resources.resourceGroups.list());
        const result = items.map((rg) => ({
          name: rg.name,
          location: rg.location,
          tags: rg.tags,
          provisioningState: rg.properties?.provisioningState,
        }));
        return textResult(result);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── Cost Management ───

  server.tool(
    "query_costs",
    "Query Azure Cost Management with flexible grouping, filtering, and time range. For Custom timeframe, provide startDate and endDate.",
    {
      org: orgSchema,
      timeframe: z
        .enum(["MonthToDate", "TheLastMonth", "TheLastBillingMonth", "BillingMonthToDate", "WeekToDate", "Custom"])
        .default("MonthToDate")
        .describe("Time range. Use 'Custom' with startDate/endDate for specific periods."),
      startDate: z
        .string()
        .optional()
        .describe("Start date when timeframe is Custom (e.g., 2026-01-01 or 2026-01-01T00:00:00Z)"),
      endDate: z
        .string()
        .optional()
        .describe("End date when timeframe is Custom (e.g., 2026-01-31 or 2026-01-31T23:59:59Z)"),
      granularity: z
        .enum(["Daily", "Monthly", "None"])
        .default("None")
        .describe("Data granularity"),
      groupBy: z
        .union([z.string(), z.array(z.string())])
        .default("ResourceGroup")
        .describe("Dimension(s) to group by: ResourceGroup, ServiceName, ResourceType, MeterCategory, ResourceLocation. Pass an array for multiple dimensions (max 2)."),
      filterDimension: z
        .string()
        .optional()
        .describe("Dimension name to filter on (e.g., ResourceGroup, ServiceName)"),
      filterValues: z
        .array(z.string())
        .optional()
        .describe("Values to include in the filter (e.g., ['rg-mygroup', 'rg-other'])"),
    },
    async ({ org, timeframe, startDate, endDate, granularity, groupBy, filterDimension, filterValues }) => {
      try {
        const clients = clientManager.getClients(org);
        const scope = `subscriptions/${clients.subscriptionId}`;
        const queryDef = buildCostQuery({ timeframe, startDate, endDate, granularity, groupBy, filterDimension, filterValues });
        const result = await withRetry(() => clients.costManagement.query.usage(scope, queryDef));
        const { columns, rows } = parseCostResult(result);
        return textResult({ columns, row_count: rows.length, rows });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_cost_by_resource_group",
    "Get costs grouped by resource group, sorted by highest cost. For custom periods use timeframe=Custom with startDate/endDate.",
    {
      org: orgSchema,
      timeframe: z
        .enum(["MonthToDate", "TheLastMonth", "TheLastBillingMonth", "Custom"])
        .default("TheLastMonth")
        .describe("Time range"),
      startDate: z.string().optional().describe("Start date for Custom (e.g., 2026-01-01)"),
      endDate: z.string().optional().describe("End date for Custom (e.g., 2026-01-31)"),
      top: z.number().min(1).max(100).default(10).describe("Number of top resource groups to return"),
    },
    async ({ org, timeframe, startDate, endDate, top }) => {
      try {
        const clients = clientManager.getClients(org);
        const scope = `subscriptions/${clients.subscriptionId}`;
        const queryDef = buildCostQuery({ timeframe, startDate, endDate, groupBy: "ResourceGroup" });
        const result = await withRetry(() => clients.costManagement.query.usage(scope, queryDef));
        const { rows } = parseCostResult(result);
        const sorted = rows
          .sort((a, b) => (b.PreTaxCost || 0) - (a.PreTaxCost || 0))
          .slice(0, top);
        return textResult({ timeframe, top_resource_groups: sorted });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_cost_by_service",
    "Get costs grouped by service name, sorted by highest cost. For custom periods use timeframe=Custom with startDate/endDate.",
    {
      org: orgSchema,
      timeframe: z
        .enum(["MonthToDate", "TheLastMonth", "TheLastBillingMonth", "Custom"])
        .default("TheLastMonth")
        .describe("Time range"),
      startDate: z.string().optional().describe("Start date for Custom (e.g., 2026-01-01)"),
      endDate: z.string().optional().describe("End date for Custom (e.g., 2026-01-31)"),
      top: z.number().min(1).max(100).default(10).describe("Number of top services to return"),
    },
    async ({ org, timeframe, startDate, endDate, top }) => {
      try {
        const clients = clientManager.getClients(org);
        const scope = `subscriptions/${clients.subscriptionId}`;
        const queryDef = buildCostQuery({ timeframe, startDate, endDate, groupBy: "ServiceName" });
        const result = await withRetry(() => clients.costManagement.query.usage(scope, queryDef));
        const { rows } = parseCostResult(result);
        const sorted = rows
          .sort((a, b) => (b.PreTaxCost || 0) - (a.PreTaxCost || 0))
          .slice(0, top);
        return textResult({ timeframe, top_services: sorted });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "get_daily_costs",
    "Get daily cost breakdown for a time period, optionally grouped by a dimension. For custom periods use timeframe=Custom with startDate/endDate.",
    {
      org: orgSchema,
      timeframe: z
        .enum(["MonthToDate", "TheLastMonth", "TheLastBillingMonth", "Custom"])
        .default("MonthToDate")
        .describe("Time range"),
      startDate: z.string().optional().describe("Start date for Custom (e.g., 2026-01-01)"),
      endDate: z.string().optional().describe("End date for Custom (e.g., 2026-01-31)"),
      groupBy: z
        .string()
        .optional()
        .describe("Optional dimension to group by (e.g., ResourceGroup, ServiceName)"),
    },
    async ({ org, timeframe, startDate, endDate, groupBy }) => {
      try {
        const clients = clientManager.getClients(org);
        const scope = `subscriptions/${clients.subscriptionId}`;
        const queryDef = buildCostQuery({ timeframe, startDate, endDate, granularity: "Daily", groupBy });
        const result = await withRetry(() => clients.costManagement.query.usage(scope, queryDef));
        const { rows } = parseCostResult(result);
        return textResult({ timeframe, granularity: "Daily", row_count: rows.length, rows });
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── Monitor Metrics ───

  server.tool(
    "list_metric_definitions",
    "List all available metric definitions for a resource. Use this to discover which metrics can be queried for App Services, PostgreSQL, Application Gateways, VMs, etc.",
    {
      org: orgSchema,
      resourceUri: z
        .string()
        .describe("Full Azure resource URI (e.g., /subscriptions/.../providers/Microsoft.Web/sites/myapp)"),
    },
    async ({ org, resourceUri }) => {
      try {
        const { monitor } = clientManager.getClients(org);
        const definitions = [];
        for await (const def of monitor.metricDefinitions.list(resourceUri)) {
          definitions.push({
            name: def.name?.value,
            displayName: def.name?.localizedValue,
            unit: def.unit,
            aggregationType: def.primaryAggregationType,
            supportedAggregations: def.supportedAggregationTypes,
            namespace: def.namespace,
          });
        }
        return textResult(definitions);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  server.tool(
    "query_metrics",
    "Query Azure Monitor metrics for any resource. Use list_metric_definitions to discover available metrics. Duration examples: PT1H (1 hour), PT12H (12 hours), P1D (1 day), P7D (7 days), P30D (30 days).",
    {
      org: orgSchema,
      resourceUri: z
        .string()
        .describe("Full Azure resource URI"),
      metricNames: z
        .string()
        .describe("Comma-separated metric names (e.g., 'Percentage CPU,Network In Total')"),
      timespan: z
        .string()
        .default("P1D")
        .describe("ISO 8601 duration or interval (e.g., PT1H, P1D, P7D, P30D, or 2026-01-01T00:00:00Z/2026-01-31T23:59:59Z)"),
      interval: z
        .string()
        .optional()
        .describe("Aggregation interval (e.g., PT5M, PT1H, P1D). If omitted, Azure picks the best."),
      aggregation: z
        .string()
        .optional()
        .describe("Aggregation type: Average, Total, Maximum, Minimum, Count (comma-separated for multiple)"),
    },
    async ({ org, resourceUri, metricNames, timespan, interval, aggregation }) => {
      try {
        const { monitor } = clientManager.getClients(org);
        const options = {
          metricnames: metricNames,
          timespan,
        };
        if (interval) options.interval = interval;
        if (aggregation) options.aggregation = aggregation;
        const response = await monitor.metrics.list(resourceUri, options);
        const result = (response.value || []).map((metric) => ({
          name: metric.name?.value,
          displayName: metric.name?.localizedValue,
          unit: metric.unit,
          timeseries: (metric.timeseries || []).map((ts) => ({
            metadataValues: ts.metadatavalues,
            data: (ts.data || []).map((dp) => ({
              timeStamp: dp.timeStamp,
              average: dp.average,
              total: dp.total,
              maximum: dp.maximum,
              minimum: dp.minimum,
              count: dp.count,
            })),
          })),
        }));
        return truncatedResult(result);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );

  // ─── VNets ───

  server.tool(
    "list_vnets",
    "List all Virtual Networks with their subnets, address spaces, and peerings",
    { org: orgSchema },
    async ({ org }) => {
      try {
        const clients = clientManager.getClients(org);
        const result = await clients.resourceGraph.resources({
          subscriptions: [clients.subscriptionId],
          query: `Resources
            | where type == "microsoft.network/virtualnetworks"
            | project name, resourceGroup, location, subscriptionId,
                      addressSpace=properties.addressSpace.addressPrefixes,
                      subnets=properties.subnets,
                      peerings=properties.virtualNetworkPeerings
            | order by name asc`,
        });
        const vnets = (result.data || []).map((v) => ({
          name: v.name,
          resourceGroup: v.resourceGroup,
          location: v.location,
          subscriptionId: v.subscriptionId,
          addressSpace: v.addressSpace,
          subnets: (v.subnets || []).map((s) => ({
            name: s.name,
            addressPrefix: s.properties?.addressPrefix,
            nsg: s.properties?.networkSecurityGroup?.id?.split("/").pop(),
          })),
          peerings: (v.peerings || []).map((p) => ({
            name: p.name,
            remoteVnet: p.properties?.remoteVirtualNetwork?.id?.split("/").pop(),
            state: p.properties?.peeringState,
          })),
        }));
        return textResult(vnets);
      } catch (error) {
        return errorResult(error.message);
      }
    }
  );
}
