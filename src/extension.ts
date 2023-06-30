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
import { SQLHistory } from './common/sqlHistory';


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
  
  // 初始化 SQL 历史记录
  SQLHistory.getInstance();

  try {
    let commandPath = context.asAbsolutePath(path.join('out', 'commands'));
    console.log('Loading commands from:', commandPath);
    
    let files = fs.readdirSync(commandPath);
    console.log('Found command files:', files);
    
    for (const file of files) {
      if (path.extname(file) === '.map') continue;
      let baseName = path.basename(file, '.js');
      let className = baseName + 'Command';
      
      try {
        console.log(`Loading command: ${baseName}, class: ${className}`);
        let commandClass = require(`./commands/${baseName}`);
        console.log('Command module loaded:', Object.keys(commandClass));
        
        if (!commandClass[className]) {
          console.error(`Class ${className} not found in module`);
          continue;
        }
        
        new commandClass[className](context);
        console.log(`Successfully registered command: vscode-postgres.${baseName}`);
      } catch (cmdErr) {
        console.error(`Error loading command ${baseName}:`, cmdErr);
      }
    }
  }
  catch (err) {
    console.error('Command loading error:', err);
    vscode.window.showErrorMessage(`Failed to load PostgreSQL commands: ${err.message}`);
  }

  Global.ResultManager = new ResultsManager();
  context.subscriptions.push(Global.ResultManager);

  vscode.workspace.onDidOpenTextDocument(async (e: vscode.TextDocument) => {
    await EditorState.setNonActiveConnection(e, null);
  });

  const configFS = new ConfigFS();
  context.subscriptions.push(vscode.workspace.registerFileSystemProvider('postgres-config', configFS, {isCaseSensitive: true}));

  // EditorState.connection = null;
  // if (vscode.window && vscode.window.activeTextEditor) {
  //   let doc = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
  //   await EditorState.setNonActiveConnection(doc, null);
  //   EditorState.getInstance().onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
  // }
}

// this method is called when your extension is deactivated
export function deactivate() {
}