'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import PostgreSQLLanguageClient from './language/client';
import { PostgreSQLTreeDataProvider } from './tree/treeProvider';
import { Global } from './common/global';
import { EditorState } from './common/editorState';
import { ConfigFS } from './common/configFileSystem';
import { ResultsManager } from './resultsview/resultsManager';
import { IConnection } from './common/IConnection';
import { Constants } from './common/constants';
import { updateMcpConnection, getConnection } from './mcp/updateMcpConnection';
import { startMcpServer } from './mcp/server';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(`Congratulations, your extension "${context.extension.id}" is now active!`);
  let languageClient: PostgreSQLLanguageClient = new PostgreSQLLanguageClient(context);
  let treeProvider: PostgreSQLTreeDataProvider = PostgreSQLTreeDataProvider.getInstance(context);
  Global.context = context;
  EditorState.getInstance(languageClient);

  try {
    let commandPath = context.asAbsolutePath(path.join('out', 'commands'));
    let files = fs.readdirSync(commandPath);
    for (const file of files) {
      if (path.extname(file) === '.map') continue;
      let baseName = path.basename(file, '.js');
      let className = baseName + 'Command';

      let commandClass = require(`./commands/${baseName}`);

      // console.debug(`${commandClass.hasOwnProperty(className) ? 'Found' : 'Did not find'} command class ${className} in ./commands/${baseName}`);
      // console.debug(`${className} has type ${typeof commandClass[className]}`);

      console.debug(`Loading command: ${className}`);
      console.warn(`The type of require(\`./commands/${baseName}\`)[${className}] is ${typeof commandClass[className]}`);

      new commandClass[className](context);
    }
  }
  catch (err) {
    console.error('Command loading error:', err);
  }

  Global.ResultManager = new ResultsManager();
  context.subscriptions.push(Global.ResultManager);

  vscode.workspace.onDidOpenTextDocument(async (e: vscode.TextDocument) => {
    await EditorState.setNonActiveConnection(e, null);
  });

  const configFS = new ConfigFS();
  context.subscriptions.push(vscode.workspace.registerFileSystemProvider('postgres-config', configFS, { isCaseSensitive: true }));

  // EditorState.connection = null;
  // if (vscode.window && vscode.window.activeTextEditor) {
  //   let doc = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
  //   await EditorState.setNonActiveConnection(doc, null);
  //   EditorState.getInstance().onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
  // }

  // spawn a new process and start a MCP server
  try {
    const port = startMcpServer();
    Global.McpServerUri = vscode.Uri.parse(`http://localhost:${port}/mcp`);
    vscode.window.showInformationMessage('MCP server for VS Code PostgreSQL extension started successfully.');
  } catch (err) {
    console.error('MCP server start error:', err);
    vscode.window.showErrorMessage('Failed to start MCP server for VS Code PostgreSQL extension. Please check the output channel for details.');
  }

  if (Global.McpServerUri) {
    const mcpServerHandler = vscode.lm.registerMcpServerDefinitionProvider(
      "vscode-postgres.mcpservers",
      {
        provideMcpServerDefinitions: async (token) => {
          return [
            new vscode.McpHttpServerDefinition(
              "vscode-postgres-mcpserver",
              Global.McpServerUri,
            )
          ]
        },
        resolveMcpServerDefinition: async (definition: any) => {
          return definition;
        }
      }
    )
    context.subscriptions.push(mcpServerHandler);

    // if there's any connection, update the MCP server connection to select the first one
    try {
      const connections = Global.context.globalState.get<{ [key: string]: IConnection }>(Constants.GlobalStateKey);
      if (connections) {
        const firstConnectionKey = Object.keys(connections)[0];
        const firstConnection = await getConnection(firstConnectionKey);
        await updateMcpConnection(firstConnection);
      }
    } catch (err) {
      console.error('MCP server registration error:', err);
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
}