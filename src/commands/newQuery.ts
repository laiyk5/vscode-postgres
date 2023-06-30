import BaseCommand from "../common/baseCommand";
import * as vscode from 'vscode';
import { IConnection } from "../common/IConnection";
import { EditorState } from "../common/editorState";

class newQueryCommand extends BaseCommand {
  async run(treeNode?: any): Promise<void> {
    try {
      // Create a new untitled document with postgres language
      const textDocument = await vscode.workspace.openTextDocument({
        language: 'postgres',
        content: ''
      });

      // Show the new document
      const editor = await vscode.window.showTextDocument(textDocument);

      // Set connection if provided
      if (treeNode?.connection) {
        EditorState.connection = treeNode.connection;
      }

      console.log('Successfully created new query document');
    } catch (err) {
      console.error('Error creating new query:', err);
      throw err;
    }
  }
}

export { newQueryCommand };