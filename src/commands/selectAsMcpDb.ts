import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { DatabaseNode } from "../tree/databaseNode";
import { updateMcpConnection } from "../mcp/updateMcpConnection";


export class selectAsMcpDbCommand extends BaseCommand {
    async run(databaseNode: DatabaseNode) {
        let connection: IConnection;

        if (databaseNode) {
            connection = databaseNode.connection;
        }

        if (!databaseNode) {
            return;
        }

        // set the MCP connection
        updateMcpConnection(connection).then(() => { vscode.window.showInformationMessage('MCP connection updated successfully.'); }).catch(err => {
            vscode.window.showErrorMessage(`Failed to update MCP connection: ${err.message}`);
        });
    }
}
