#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import * as express from 'express';
import * as postgres from 'postgres'
import * as vscode from 'vscode';
import { z } from 'zod';
import { IConnection } from "../common/IConnection";
import { EditorState } from "../common/editorState";
import { getPort } from "get-port-please";

class MCPServerState {
    public static mcpServer: McpServer | null = null;
    public static app: express.Express | null = null;
    /* Database connection info is used to compare and see if we need to re-initialize
    */
    private static _conn: IConnection | null = null;
    private static _sql: postgres.Sql | null = null;

    private static _this: MCPServerState | null = null;

    public static get_instance(): MCPServerState {
        if (!MCPServerState._this) {
            MCPServerState._this = new MCPServerState();
        }
        return MCPServerState._this;
    }

    public static async get_sql(): Promise<postgres.Sql | null> {
        if (EditorState.connection) {
            if (!MCPServerState._sql || MCPServerState._conn !== EditorState.connection) {
                if (MCPServerState._sql) {
                    await MCPServerState._sql.end();
                    MCPServerState.set_sql(null);
                }
                await initializeDatabase({
                    host: EditorState.connection.host,
                    port: EditorState.connection.port,
                    database: EditorState.connection.database,
                    user: EditorState.connection.user,
                    password: EditorState.connection.password,
                    ssl: !!EditorState.connection.ssl ? true : false
                }).catch((error) => {
                    console.error('Failed to initialize database connection:', error);
                });
                MCPServerState._conn = EditorState.connection;
            }
            return MCPServerState._sql;
        } else {
            return null;
        }
    };

    public static set_sql(value: postgres.Sql | null) {
        MCPServerState._sql = value;
        MCPServerState._conn = null;
    };

};

// Database connection setup

async function initializeDatabase(options: postgres.Options<any>) {
    console.debug('Database connection established with options:', options);
    const sql = postgres(options);
    await sql`SELECT 1`; // Test the connection
    MCPServerState.set_sql(sql);
}

async function closeDatabase() {
    const sql = await MCPServerState.get_sql();
    if (sql) {
        await sql.end();
        MCPServerState.set_sql(null);
    }
}

// Configure the server
const server = new McpServer({
    name: "PostgreSQL MCP Server",
    version: "1.0.0",
});


/**
 * Format success response
 * @param data Data to format
 * @returns Formatted success response object
 */
export function formatSuccessResponse(data: any) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(data, null, 2)
    }],
    structuredContent: data
  };
}

async function getSqlWithBestEffort() {
    let sql = await MCPServerState.get_sql();
    if (!sql) {
        await vscode.commands.executeCommand('vscode-postgres.selectConnection')
        sql = await MCPServerState.get_sql();
        if (!sql) {
            throw new Error("Database connection is not initialized.");
        }
    }
    return sql;
}

/**
 * List all tables in the database
 * @returns Array of the table names
 */
async function listTables(): Promise<string[]> {
    const sql = await getSqlWithBestEffort();
    const result = await sql`
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
    `;
    return result.map(row => row.tablename);
}
server.registerTool(
    "list_tables",
    {
        title: "List Tables",
        description: "Lists all tables in the connected PostgreSQL database.",
        outputSchema: {
            tables: z.array(z.string())
        }
    },
    async () => {
        try {
            const tables = await listTables();
            console.debug('Tables retrieved:', tables);
            return {
                content: [{ type: "text", text: JSON.stringify({ tables }, null, 2) }],
                structuredContent: { tables },
            };
        } catch (error) {
            throw new Error(`Failed to list tables: ${error.message}`);
        }
    }
);

/**
 * Get schema information for a specific table
 * @param tableName Name of the table to describe
 * @returns Column definitions for the table
 */
export async function describeTable(tableName: string): Promise<any[]> {
    const sql = await getSqlWithBestEffort();
    const result = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${tableName};
    `;
    return result.map(row => ({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable
    }));
}
server.registerTool(
    "describe_table",
    {
        title: "Describe Table",
        description: "Describes the schema of a specific table in the connected PostgreSQL database.",
        inputSchema: {
            tableName: z.string()
        },
    },
    async ({ tableName }) => {
        try {
            const schema = await describeTable(tableName);
            return formatSuccessResponse({ tableName, schema });
        } catch (error) {
            throw new Error(`Failed to describe table: ${error.message}`);
        }
    }
);

/**
 * Execute a read-only SQL query
 * @param query SQL query to execute
 * @returns Query results
 */
export async function readQuery(query: string): Promise<any> {
    const sql = await getSqlWithBestEffort();
    const result = await sql.unsafe(query);
    return result;
}

server.registerTool(
    "read_query",
    {
        title: "Read Query",
        description: "Executes a read-only SQL query against the connected PostgreSQL database.",
        inputSchema: {
            query: z.string()
        }
    },
    async ({ query }) => {
        try {
            const results = await readQuery(query);
            return formatSuccessResponse({ results });
        } catch (error) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }
)

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

app.post('/set-connection', async (req, res) => {
    const { host, port, database, user, password, ssl } = req.body;

    try {
        // Close existing connection if any
        await closeDatabase();

        // Create new connection
        await initializeDatabase({
            host: host || 'localhost',
            port: port ? parseInt(port, 10) : 5432,
            database: database || 'postgres',
            user: user || 'postgres',
            password: password || '',
            ssl: ssl ? true : false
        });

        console.info('Database connection updated successfully.');
        res.status(200).json({ message: 'Database connection updated successfully.' });
    } catch (error) {
        console.error('Failed to set database connection:', error);
        res.status(500).json({ error: `Failed to set database connection: ${error.message}` });
    }
});

export async function startMcpServer(): Promise<number> {
    // Start the server
    let port = await getPort({
        port: 4000,
        portRange: [8000,9000],
        host: 'localhost'
    })
    app.listen(port, () => {
        console.info(`Demo MCP Server running on http://localhost:${port}/mcp`);
        console.info(`Set connection on http://localhost:${port}/set-connection`);
        console.info(`MCP server is listening on port ${port}`);
    }).on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });
    return port;
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.info('Shutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.info('Shutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});

// Add global error handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
