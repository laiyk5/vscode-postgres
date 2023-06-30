'use strict';

import * as vscode from 'vscode';

export default abstract class BaseCommand {
  protected readonly commandPrefix = 'vscode-postgres.';

  constructor(context: vscode.ExtensionContext) {
    const commandName = this.constructor.name.replace(/Command$/, '');
    const fullCommandName = this.commandPrefix + commandName;
    
    // 使用箭头函数来保持this上下文
    const disposable = vscode.commands.registerCommand(fullCommandName, async (...args: any[]) => {
      try {
        await this.run(...args);
      } catch (err) {
        console.error(`Error executing command ${fullCommandName}:`, err);
        vscode.window.showErrorMessage(`Error executing command: ${err.message}`);
      }
    });

    context.subscriptions.push(disposable);
    console.log(`Registered command: ${fullCommandName}`);
  }
  
  abstract run(...args: any[]): Promise<void> | void;
}