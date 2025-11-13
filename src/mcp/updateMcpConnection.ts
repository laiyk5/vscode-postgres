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
    const McpServerUri = Global.McpServerUri;

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

    // construct the schema://authority/set-connection endpoint
    if (!McpServerUri) {
        throw new Error("MCP server URI is not defined.");
    }
    const setConnectionUri = McpServerUri.with({ path: '/set-connection' });

    console.debug(`The setConnectionUri is ${setConnectionUri.toString()}`);
    // send HTTP POST to set the connection
    try {
        const response = await fetch(setConnectionUri.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                host: connection.host,
                port: connection.port,
                database: connection.database,
                user: connection.user,
                password: connection.password,
                ssl: !!connection.ssl
            })
        });
        if (!response.ok) {
            console.error(`Failed to set MCP connection: ${await response.json().then(data => JSON.stringify(data))}`);
            throw new Error(`Failed to set MCP connection: ${await response.json().then(data => data.message)}`);
        }
    } catch (error) {
        throw new Error(`Error setting MCP connection: \n\t${error.message}`);
    }
}

export { updateMcpConnection };