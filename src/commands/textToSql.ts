import * as vscode from 'vscode';
import BaseCommand from '../common/baseCommand';
import { chatWithOpenAI } from '../common/openaiClient';

'use strict';

export class textToSqlCommand extends BaseCommand {
  async run(){
    // Get the active text editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get the selected text
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    if (!selectedText) {
      vscode.window.showInformationMessage('Please select some SQL text first.');
      return;
    }

    // Create and show input box
    const inputBox = vscode.window.createInputBox();
    inputBox.title = 'Text To SQL';
    inputBox.prompt = 'Enter your request';
    inputBox.placeholder = 'chat with openai';

    // Handle the input
    inputBox.onDidAccept(async () => {
      const userInput = inputBox.value;
      inputBox.hide();
      // compose a prompt combining user input and the selected text
      const prompt = `${userInput}\n\nContext selection:\n${selectedText}`;
      try {
        // send to OpenAI; minimal wiring — no elaborate retries or validation
        const aiResult = await chatWithOpenAI(prompt);
        // replace the selected text with the returned result (best-effort)
        await editor.edit(editBuilder => editBuilder.replace(selection, aiResult));
      } catch (err) {
        // surface an error message; user asked to skip connection testing so we keep behaviour minimal
        vscode.window.showErrorMessage(`OpenAI request failed: ${err && err.message ? err.message : err}`);
      }
    });

    inputBox.show();
  }
}