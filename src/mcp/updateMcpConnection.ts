import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { Global } from "../common/global";
import { Constants } from "../common/constants";

// function getConnURL(connection: IConnection): string {
//     let userPart = connection.user ? encodeURIComponent(connection.user) : '';
//     let passwordPart = connection.password ? ':' + encodeURIComponent(connection.password) : '';
//     if (userPart || passwordPart) {
//         userPart += passwordPart + '@';
//     }
//     let hostPart = connection.host ? connection.host : 'localhost';
//     let portPart = connection.port ? ':' + connection.port : '';
//     let databasePart = connection.database ? '/' + connection.database : '';
//     return `postgresql://${userPart}${hostPart}${portPart}${databasePart}`;
// }

async function updateMcpConnection(connectionKey: string) {
    const connections = Global.context.globalState.get<{ [key: string]: IConnection }>(Constants.GlobalStateKey);
    const McpServerStateKey = Constants.GlobalStateKey + '.mcpservers';
    const servers = Global.McpServers;

    // get password and other details
    if (!connections || !connections.hasOwnProperty(connectionKey)) {
        return;
    }
    const connection = connections[connectionKey];
    if (connection.hasPassword || !connection.hasOwnProperty('hasPassword')) {
        connection.password = await Global.context.secrets.get(connectionKey);
    } else {
        connection.password = '';
    }

    // first remove existing server definition if any
    console.log(`Registering/Updating server for connectionKey: ${connectionKey}`);
    if (servers.hasOwnProperty(connectionKey)) {
        console.log(`Disposing server for connectionKey: ${typeof servers[connectionKey]} ${servers[connectionKey]}`);
        // dispose the server if present
        servers[connectionKey].dispose();
        delete servers[connectionKey];
    }

    // register/update MCP server definition
    let disposable = vscode.lm.registerMcpServerDefinitionProvider
    ('vscode-postgres.mcpservers', {
        provideMcpServerDefinitions: async (token) => {
            let servers: vscode.McpStdioServerDefinition[] = [];
            servers.push(new vscode.McpStdioServerDefinition(
                "vscode-postgres-" + connection.label,
                "npx",
                [
                    "-y",
                    "@executeautomation/database-server",
                    "--postgresql",
                    "--host", connection.host,
                    "--database", connection.database ? connection.database : "postgres",
                    "--user", connection.user,
                    connection.password ? "--password" : "",
                    connection.password ? connection.password : "",
                    "--port", connection.port ? connection.port.toString() : "5432",
                ]
            ));
            return servers;
        },
        resolveMcpServerDefinition: async (definition: any) => {
            return definition;
        }
    });
    Global.context.subscriptions.push(disposable);
    servers[connectionKey] = disposable;
    await Global.context.globalState.update(McpServerStateKey, servers);
}

async function deleteMcpConnection(connectionKey: string) {
    const McpServerStateKey = Constants.GlobalStateKey + '.mcpservers';
    const servers = Global.context.globalState.get<{ [key: string]: vscode.Disposable }>(McpServerStateKey, {});

    // remove existing server definition if any
    if (servers.hasOwnProperty(connectionKey)) {
        servers[connectionKey].dispose();
        delete servers[connectionKey];
        await Global.context.globalState.update(McpServerStateKey, servers);
    }
}

export { updateMcpConnection, deleteMcpConnection };